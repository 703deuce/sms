import { getPrisma } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { isAdminUnlimitedWorkspace } from "@/lib/billing/admin-unlimited-workspace";

/** Cents charged to the workspace credit balance per outbound SMS segment. */
export function smsCostCents(): number {
  const raw = Number(process.env.SMS_COST_CENTS);
  if (Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  return 1;
}

/**
 * Credit-balance tracking is on when Stripe billing is configured or when it is
 * explicitly enabled via env. When off, sends are never metered against credits.
 */
export function isCreditTrackingEnabled(): boolean {
  const flag = process.env.BILLING_CREDITS_ENABLED?.trim().toLowerCase();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return isStripeConfigured();
}

/**
 * Whether prepaid credit balance should gate or meter outbound usage for a workspace.
 * Pre-billing workspaces (no Stripe customer/subscription) stay unlimited until billing
 * is attached — used for physical MCTB certification before Stripe is live.
 */
export async function isWorkspaceCreditEnforced(workspaceId: string): Promise<boolean> {
  if (!workspaceId || !isCreditTrackingEnabled()) return false;
  if (await isAdminUnlimitedWorkspace(workspaceId)) return false;

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      billingPlan: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });
  if (!workspace) return false;

  const plan = String(workspace.billingPlan || "").toLowerCase();
  if (plan === "onboarding") return false;

  if (!workspace.stripeCustomerId && !workspace.stripeSubscriptionId) {
    return false;
  }

  return true;
}

export async function getCreditLedger(workspaceId: string, limit = 50) {
  const prisma = getPrisma();
  return prisma.creditLedgerEntry.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/** Look up or create a Stripe customer for the workspace, persisting the id. */
export async function getOrCreateStripeCustomer(workspaceId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error("Workspace not found");
  if (workspace.stripeCustomerId) return workspace.stripeCustomerId as string;

  const customer = await stripe.customers.create({
    name: workspace.displayName || workspace.name,
    metadata: { workspaceId },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

/** One-time Checkout Session to top up prepaid credits. */
export async function createCreditsCheckoutSession(
  workspaceId: string,
  amountCents: number,
  successUrl?: string,
  cancelUrl?: string,
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    throw new Error("amountCents must be at least 100");
  }
  const customerId = await getOrCreateStripeCustomer(workspaceId);
  const base = getAppBaseUrl();
  const rounded = Math.round(amountCents);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Messaging credits ($${(rounded / 100).toFixed(2)})` },
          unit_amount: rounded,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl || `${base}/hire?credits=success`,
    cancel_url: cancelUrl || `${base}/settings/billing?credits=canceled`,
    metadata: {
      type: "credits",
      workspaceId,
      amountCents: String(rounded),
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

/** Resolve a plan name to a configured Stripe price id via PLAN_PRICE_<PLAN> env. */
function resolvePriceId(priceIdOrPlan: string): { priceId: string; plan: string } {
  const value = priceIdOrPlan.trim();
  if (value.startsWith("price_")) {
    return { priceId: value, plan: "" };
  }
  const envKey = `STRIPE_PRICE_${value.toUpperCase()}`;
  const priceId = process.env[envKey]?.trim();
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan "${value}" (set ${envKey})`);
  }
  return { priceId, plan: value };
}

/** Subscription Checkout Session for a plan or explicit price id. */
export async function createSubscriptionCheckoutSession(
  workspaceId: string,
  priceIdOrPlan: string,
  successUrl?: string,
  cancelUrl?: string,
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");
  const { priceId, plan } = resolvePriceId(priceIdOrPlan);
  const customerId = await getOrCreateStripeCustomer(workspaceId);
  const base = getAppBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl || `${base}/hire?subscription=success`,
    cancel_url: cancelUrl || `${base}/settings/billing?subscription=canceled`,
    metadata: {
      type: "subscription",
      workspaceId,
      plan: plan || "",
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

/** Real Stripe billing portal session for managing payment methods / subscriptions. */
export async function createBillingPortalSession(
  workspaceId: string,
  returnUrl?: string,
): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");
  const customerId = await getOrCreateStripeCustomer(workspaceId);
  const base = getAppBaseUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${base}/settings/billing`,
  });
  return { url: session.url };
}

/**
 * Idempotently record purchased credits from a Stripe event and increment the
 * workspace balance. Idempotency is keyed on stripeSessionId (unique).
 */
export async function addCreditsFromStripe(
  workspaceId: string,
  amountCents: number,
  sessionId: string,
  paymentIntentId?: string | null,
  description?: string,
) {
  const prisma = getPrisma();
  const existing = await prisma.creditLedgerEntry.findFirst({ where: { stripeSessionId: sessionId } });
  if (existing) return existing;

  const recent = await prisma.creditLedgerEntry.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const prevBalance = recent?.balanceAfterCents ?? 0;
  const balanceAfterCents = prevBalance + amountCents;

  let entry;
  try {
    entry = await prisma.creditLedgerEntry.create({
      data: {
        workspaceId,
        amountCents,
        balanceAfterCents,
        description: description || `Credit purchase $${(amountCents / 100).toFixed(2)}`,
        source: "purchase",
        stripeSessionId: sessionId,
        stripePaymentIntentId: paymentIntentId || null,
      },
    });
  } catch (err) {
    // Unique violation on stripeSessionId → another worker already recorded it.
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return prisma.creditLedgerEntry.findFirst({ where: { stripeSessionId: sessionId } });
    }
    throw err;
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { creditBalanceCents: { increment: amountCents } },
  });
  return entry;
}

/**
 * Meter an outbound send against the workspace credit balance. No-op when credit
 * tracking is disabled. Returns the amount deducted (0 when skipped).
 */
export async function deductCreditsForSend(
  workspaceId: string,
  segments = 1,
  description?: string,
): Promise<number> {
  if (!(await isWorkspaceCreditEnforced(workspaceId))) return 0;
  const count = Math.max(1, Math.round(segments));
  const cost = smsCostCents() * count;
  if (cost <= 0) return 0;

  const prisma = getPrisma();
  const recent = await prisma.creditLedgerEntry.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const prevBalance = recent?.balanceAfterCents ?? 0;

  await prisma.creditLedgerEntry.create({
    data: {
      workspaceId,
      amountCents: -cost,
      balanceAfterCents: prevBalance - cost,
      description: description || `SMS send (${count} segment${count === 1 ? "" : "s"})`,
      source: "usage",
    },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { creditBalanceCents: { increment: -cost } },
  });
  return cost;
}

/** Hold workspace credits for a campaign segment reservation (shared MCTB + Mass Text pool). */
export async function holdCreditsForCampaignReservation(
  workspaceId: string,
  segments: number,
  reservationId: string,
): Promise<number> {
  if (segments <= 0) return 0;
  return deductCreditsForSend(
    workspaceId,
    segments,
    `Campaign reservation hold ${reservationId}`,
  );
}

/** Release a prior campaign credit hold back to the workspace balance. */
export async function releaseCreditsForCampaignReservation(
  workspaceId: string,
  segments: number,
  reservationId: string,
): Promise<number> {
  if (segments <= 0) return 0;
  if (!(await isWorkspaceCreditEnforced(workspaceId))) return 0;

  const count = Math.max(1, Math.round(segments));
  const refundCents = smsCostCents() * count;
  if (refundCents <= 0) return 0;

  const prisma = getPrisma();
  const recent = await prisma.creditLedgerEntry.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const prevBalance = recent?.balanceAfterCents ?? 0;

  await prisma.creditLedgerEntry.create({
    data: {
      workspaceId,
      amountCents: refundCents,
      balanceAfterCents: prevBalance + refundCents,
      description: `Campaign reservation release ${reservationId}`,
      source: "adjustment",
    },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { creditBalanceCents: { increment: refundCents } },
  });
  return refundCents;
}

/** Segments purchasable from the shared workspace credit balance. */
export async function getWorkspaceCreditSegmentsAvailable(workspaceId: string): Promise<number> {
  if (!workspaceId) return 0;
  if (await isAdminUnlimitedWorkspace(workspaceId)) {
    return 999_999_999;
  }
  if (!(await isWorkspaceCreditEnforced(workspaceId))) return 0;

  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { creditBalanceCents: true },
  });
  const balanceCents = Number(workspace?.creditBalanceCents ?? 0);
  if (balanceCents <= 0) return 0;

  const cost = smsCostCents();
  if (cost <= 0) return 999_999_999;
  return Math.floor(balanceCents / cost);
}

export type BillingSummary = {
  plan: string;
  balanceCents: number;
  balance: number;
  creditTrackingEnabled: boolean;
  stripeConfigured: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  ledger: Awaited<ReturnType<typeof getCreditLedger>>;
};

export async function getBillingSummary(workspaceId: string): Promise<BillingSummary> {
  const prisma = getPrisma();
  const [workspace, ledger] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    getCreditLedger(workspaceId),
  ]);
  const balanceCents = Number(workspace?.creditBalanceCents ?? 0);
  return {
    plan: (workspace?.billingPlan as string) || "growth",
    balanceCents,
    balance: balanceCents / 100,
    creditTrackingEnabled: isCreditTrackingEnabled(),
    stripeConfigured: isStripeConfigured(),
    stripeCustomerId: (workspace?.stripeCustomerId as string) || null,
    stripeSubscriptionId: (workspace?.stripeSubscriptionId as string) || null,
    ledger,
  };
}

export type BillingLineItem = {
  id: string;
  label: string;
  amountCents: number;
  detail?: string;
};

export type UpcomingBillEstimate = {
  currency: string;
  periodLabel: string;
  lineItems: BillingLineItem[];
  subtotalCents: number;
  estimatedTaxCents: number;
  totalCents: number;
  notes: string[];
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountDue: number;
    amountPaid: number;
    created: number;
    hostedInvoiceUrl: string | null;
    pdf: string | null;
  }>;
};

/** Plan base fee in cents when Stripe price is unavailable (env PLAN_FEE_<PLAN>_CENTS). */
function planFeeCents(plan: string): number {
  const envKey = `PLAN_FEE_${plan.toUpperCase()}_CENTS`;
  const raw = Number(process.env[envKey]);
  if (Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  const defaults: Record<string, number> = {
    starter: 4900,
    growth: 9900,
    scale: 24900,
    enterprise: 0,
  };
  return defaults[plan.toLowerCase()] ?? 9900;
}

function numberMonthlyFeeCents(): number {
  const raw = Number(process.env.NUMBER_MONTHLY_FEE_CENTS);
  if (Number.isFinite(raw) && raw >= 0) return Math.round(raw);
  return 200; // $2 / number default estimate
}

/**
 * Itemized upcoming bill estimate: subscription + numbers + period SMS usage + tax placeholder.
 * Pulls Stripe invoices when configured; never invents paid invoice rows.
 */
export async function getUpcomingBillEstimate(workspaceId: string): Promise<UpcomingBillEstimate> {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  const plan = (workspace?.billingPlan as string) || "growth";
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [numbers, usageRows] = await Promise.all([
    prisma.phoneNumber.findMany({
      where: { workspaceId },
      select: { id: true, e164: true, status: true },
    }),
    prisma.usageRecord.findMany({
      where: {
        workspaceId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
      orderBy: { periodStart: "desc" },
      take: 5,
    }),
  ]);

  const activeNumbers = numbers.filter((n: { status: string }) =>
    /active|in[-_]?use|assigned/i.test(n.status || "active"),
  );
  const numberCount = activeNumbers.length || numbers.length;
  const perNumber = numberMonthlyFeeCents();
  const numbersCents = numberCount * perNumber;

  const usage = usageRows[0];
  const smsSegments = Number(usage?.smsSegments ?? 0);
  const mmsMessages = Number(usage?.mmsMessages ?? 0);
  const usageCostFromRecord = Number(usage?.costCents ?? 0);
  const smsEstimate =
    usageCostFromRecord > 0
      ? usageCostFromRecord
      : smsSegments * smsCostCents() + mmsMessages * Math.max(smsCostCents() * 3, 3);

  const lineItems: BillingLineItem[] = [
    {
      id: "subscription",
      label: `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`,
      amountCents: planFeeCents(plan),
      detail: "Base subscription (estimate if Stripe price not loaded)",
    },
    {
      id: "numbers",
      label: `Phone numbers (${numberCount})`,
      amountCents: numbersCents,
      detail: `${(perNumber / 100).toFixed(2)} USD each / month`,
    },
    {
      id: "sms_usage",
      label: "Messaging usage (this period)",
      amountCents: smsEstimate,
      detail: `${smsSegments} SMS segments · ${mmsMessages} MMS`,
    },
  ];

  // Voice usage records when present
  try {
    const voiceUsage = await prisma.voiceUsageRecord.findMany({
      where: {
        workspaceId,
        createdAt: { gte: periodStart },
      },
      take: 200,
    });
    const voiceCents = voiceUsage.reduce(
      (sum: number, r: { billedCostCents?: number | null; providerCostCents?: number | null }) =>
        sum + Number(r.billedCostCents ?? r.providerCostCents ?? 0),
      0,
    );
    if (voiceCents > 0) {
      lineItems.push({
        id: "voice_usage",
        label: "Voice usage (this period)",
        amountCents: voiceCents,
        detail: `${voiceUsage.length} usage row(s)`,
      });
    }
  } catch {
    // voice usage table may be empty / unavailable
  }

  const subtotalCents = lineItems.reduce((s, i) => s + i.amountCents, 0);
  const taxRate = Number(process.env.BILLING_ESTIMATED_TAX_RATE || 0);
  const estimatedTaxCents =
    Number.isFinite(taxRate) && taxRate > 0 ? Math.round(subtotalCents * taxRate) : 0;

  const invoices: UpcomingBillEstimate["invoices"] = [];
  const notes: string[] = [
    "Estimate only — final invoice amounts come from Stripe when billing is configured.",
    "Taxes shown only when BILLING_ESTIMATED_TAX_RATE is set (e.g. 0.08).",
  ];

  const stripe = getStripe();
  const customerId = workspace?.stripeCustomerId as string | null;
  if (stripe && customerId) {
    try {
      const list = await stripe.invoices.list({ customer: customerId, limit: 12 });
      for (const inv of list.data) {
        invoices.push({
          id: inv.id,
          number: inv.number ?? null,
          status: inv.status ?? null,
          amountDue: inv.amount_due,
          amountPaid: inv.amount_paid,
          created: inv.created,
          hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          pdf: inv.invoice_pdf ?? null,
        });
      }
      const upcoming = await stripe.invoices
        .createPreview({ customer: customerId })
        .catch(() => null);
      if (upcoming) {
        notes.unshift(
          `Stripe upcoming invoice total: $${(upcoming.amount_due / 100).toFixed(2)} (authoritative when present).`,
        );
        // Prefer Stripe line items when available
        if (upcoming.lines?.data?.length) {
          lineItems.length = 0;
          for (const line of upcoming.lines.data) {
            lineItems.push({
              id: line.id,
              label: line.description || "Line item",
              amountCents: line.amount,
              detail: line.period
                ? `${new Date(line.period.start * 1000).toLocaleDateString()} – ${new Date(line.period.end * 1000).toLocaleDateString()}`
                : undefined,
            });
          }
          return {
            currency: upcoming.currency || "usd",
            periodLabel: `${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`,
            lineItems,
            subtotalCents: upcoming.subtotal ?? lineItems.reduce((s, i) => s + i.amountCents, 0),
            estimatedTaxCents: Number(
              (upcoming as { total_taxes?: Array<{ amount?: number }> }).total_taxes?.reduce(
                (s, t) => s + Number(t.amount || 0),
                0,
              ) ?? 0,
            ),
            totalCents: upcoming.amount_due,
            notes,
            invoices,
          };
        }
      }
    } catch (err) {
      notes.push(
        `Stripe invoice sync unavailable: ${err instanceof Error ? err.message.slice(0, 80) : "error"}`,
      );
    }
  } else if (!isStripeConfigured()) {
    notes.push("Stripe is not configured — showing local estimate from plan + numbers + usage.");
  }

  return {
    currency: "usd",
    periodLabel: `${periodStart.toISOString().slice(0, 10)} → ${periodEnd.toISOString().slice(0, 10)}`,
    lineItems,
    subtotalCents,
    estimatedTaxCents,
    totalCents: subtotalCents + estimatedTaxCents,
    notes,
    invoices,
  };
}

/** Grant credits (trial, admin adjust, or local mock top-up). Updates ledger + balance. */
export async function grantCredits(
  workspaceId: string,
  amountCents: number,
  description: string,
  source = "adjustment",
) {
  const prisma = getPrisma();
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) throw new Error("Workspace not found");
  const prevBalance = Number(workspace.creditBalanceCents ?? 0);
  const balanceAfterCents = prevBalance + amountCents;
  const entry = await prisma.creditLedgerEntry.create({
    data: {
      workspaceId,
      amountCents,
      balanceAfterCents,
      description,
      source,
    },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { creditBalanceCents: balanceAfterCents },
  });
  return entry;
}

/**
 * Dev-only fallback: add credits without Stripe. Only usable when the Stripe key
 * is missing. Prefer grantCredits for trial/admin grants.
 */
export async function addMockCredits(
  workspaceId: string,
  amountCents: number,
  description?: string,
) {
  if (isStripeConfigured()) {
    throw new Error("Stripe is configured — use a real checkout session instead of mock credits");
  }
  return grantCredits(
    workspaceId,
    amountCents,
    description || `Credit purchase $${(amountCents / 100).toFixed(2)} (mock)`,
    "purchase",
  );
}
