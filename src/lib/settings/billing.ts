import { getPrisma } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe/client";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";

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
    success_url: successUrl || `${base}/settings/billing?credits=success`,
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
    success_url: successUrl || `${base}/settings/billing?subscription=success`,
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
  if (!isCreditTrackingEnabled()) return 0;
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

/**
 * Dev-only fallback: add credits without Stripe. Only usable when the Stripe key
 * is missing. Also increments Workspace.creditBalanceCents so balances stay in sync.
 */
export async function addMockCredits(
  workspaceId: string,
  amountCents: number,
  description?: string,
) {
  if (isStripeConfigured()) {
    throw new Error("Stripe is configured — use a real checkout session instead of mock credits");
  }
  const prisma = getPrisma();
  const recent = await prisma.creditLedgerEntry.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const prevBalance = recent?.balanceAfterCents ?? 0;
  const balanceAfterCents = prevBalance + amountCents;

  const entry = await prisma.creditLedgerEntry.create({
    data: {
      workspaceId,
      amountCents,
      balanceAfterCents,
      description: description || `Credit purchase $${(amountCents / 100).toFixed(2)} (mock)`,
      source: "purchase",
    },
  });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { creditBalanceCents: { increment: amountCents } },
  });
  return entry;
}
