import "server-only";

import { getPrisma } from "@/lib/db";
import { calculatePaymentAmounts } from "@/lib/merchant-payments/amounts";
import type { PaymentRequirement } from "@/lib/appointments/types";
import { listEligibleEntitlementsForContact, redeemPackageCredit } from "./entitlements";
import { redeemGiftCertificate } from "./gift-certificates";

export type BookingEntitlementSelection =
  | { method: "package"; packageBalanceId: string }
  | { method: "gift"; giftCertificateCode: string }
  | { method: "none" };

export function resolvePackageCreditKey(
  remainingCredits: Record<string, number>,
  bookingTypeId?: string,
  serviceName?: string,
): string | null {
  if (bookingTypeId && (remainingCredits[bookingTypeId] ?? 0) > 0) return bookingTypeId;
  if (serviceName && (remainingCredits[serviceName] ?? 0) > 0) return serviceName;
  if ((remainingCredits.default ?? 0) > 0) return "default";
  for (const [key, value] of Object.entries(remainingCredits)) {
    if (value > 0) return key;
  }
  return null;
}

export function packageCreditsRemaining(remainingCredits: Record<string, number>): number {
  return Object.values(remainingCredits).reduce((sum, n) => sum + (n || 0), 0);
}

export function suggestAutoEntitlement(
  entitlements: Awaited<ReturnType<typeof lookupBookingEntitlements>>,
): { method: "package" | "gift" | "none"; packageBalanceId?: string; giftCode?: string } {
  if (entitlements.packages.length === 1) {
    return { method: "package", packageBalanceId: entitlements.packages[0].id };
  }
  if (!entitlements.packages.length && entitlements.gifts.length === 1) {
    return { method: "gift", giftCode: entitlements.gifts[0].code };
  }
  return { method: "none" };
}

export async function lookupBookingEntitlements(input: {
  workspaceId: string;
  contactId: string;
  bookingTypeId?: string;
  serviceName?: string;
}) {
  const { packages, gifts, memberships } = await listEligibleEntitlementsForContact(
    input.workspaceId,
    input.contactId,
  );

  const now = Date.now();
  const eligiblePackages = packages
    .filter((pkg: (typeof packages)[number]) => {
      if (pkg.expiresAt && pkg.expiresAt.getTime() < now) return false;
      const credits = (pkg.remainingCredits || {}) as Record<string, number>;
      return resolvePackageCreditKey(credits, input.bookingTypeId, input.serviceName) != null;
    })
    .map((pkg: (typeof packages)[number]) => {
      const credits = (pkg.remainingCredits || {}) as Record<string, number>;
      const creditKey = resolvePackageCreditKey(credits, input.bookingTypeId, input.serviceName);
      return {
        id: pkg.id,
        productName: pkg.product?.name || "Package",
        creditKey,
        creditsRemaining: packageCreditsRemaining(credits),
        expiresAt: pkg.expiresAt?.toISOString() || null,
      };
    });

  const eligibleGifts = gifts
    .filter((gift: (typeof gifts)[number]) => (gift.balanceCents || 0) > 0)
    .map((gift: (typeof gifts)[number]) => ({
      id: gift.id,
      code: gift.code,
      balanceCents: gift.balanceCents,
      recipientName: gift.recipientName,
    }));

  return {
    packages: eligiblePackages,
    gifts: eligibleGifts,
    memberships: memberships.map((m: (typeof memberships)[number]) => ({
      id: m.id,
      productName: m.product?.name || "Membership",
      status: m.status,
    })),
  };
}

export async function resolveContactIdByPhone(
  workspaceId: string,
  phone: string,
  email?: string,
): Promise<string | null> {
  const prisma = getPrisma();
  const { normalizeE164 } = await import("@/lib/messaging/twilio-mappings");
  const normalized = normalizeE164(phone);
  const contact = await prisma.contact.findFirst({
    where: {
      workspaceId,
      OR: [{ phone: normalized }, ...(email ? [{ email: email.trim() }] : [])],
    },
    select: { id: true },
  });
  return contact?.id || null;
}

function paymentAmountDueCents(payment?: PaymentRequirement): number {
  if (!payment || payment.mode === "none") return 0;
  const amounts = calculatePaymentAmounts({
    mode: payment.mode as "deposit" | "full",
    priceCents: payment.priceCents,
    depositCents: payment.depositCents,
    depositPercent: payment.depositPercent,
    currency: payment.currency,
    provider: payment.provider || "stripe",
  });
  return amounts.amountDueCents;
}

export async function applyBookingEntitlement(input: {
  workspaceId: string;
  appointmentId: string;
  contactId: string;
  bookingTypeId?: string;
  serviceName?: string;
  payment?: PaymentRequirement;
  selection: BookingEntitlementSelection;
}): Promise<{
  applied: boolean;
  method: "package" | "gift" | "none";
  paymentWaived: boolean;
  amountCentsWaived: number;
  packageBalanceId?: string;
  giftBalanceId?: string;
  giftCode?: string;
}> {
  if (input.selection.method === "none") {
    return { applied: false, method: "none", paymentWaived: false, amountCentsWaived: 0 };
  }

  const amountDue = paymentAmountDueCents(input.payment);

  if (input.selection.method === "package") {
    const prisma = getPrisma();
    const balance = await prisma.packageBalance.findFirst({
      where: {
        id: input.selection.packageBalanceId,
        workspaceId: input.workspaceId,
        contactId: input.contactId,
        status: "active",
      },
    });
    if (!balance) throw new Error("Package balance not found");

    const credits = (balance.remainingCredits || {}) as Record<string, number>;
    const creditKey =
      resolvePackageCreditKey(credits, input.bookingTypeId, input.serviceName) || "default";

    await redeemPackageCredit(
      balance.id,
      input.bookingTypeId || input.serviceName || "default",
      input.appointmentId,
      creditKey,
    );

    return {
      applied: true,
      method: "package",
      paymentWaived: true,
      amountCentsWaived: amountDue,
      packageBalanceId: balance.id,
    };
  }

  const code = input.selection.giftCertificateCode.trim().toUpperCase();
  if (!code) throw new Error("Gift certificate code is required");
  if (amountDue <= 0) {
    throw new Error("Gift certificates apply to paid appointments only");
  }

  const redeemAmount = amountDue;
  const result = await redeemGiftCertificate(
    input.workspaceId,
    code,
    redeemAmount,
    input.appointmentId,
  );

  return {
    applied: true,
    method: "gift",
    paymentWaived: true,
    amountCentsWaived: redeemAmount,
    giftBalanceId: result.balanceId,
    giftCode: code,
  };
}

export async function restoreBookingEntitlements(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();

  const packageEntries = await prisma.packageLedgerEntry.findMany({
    where: { appointmentId, kind: "redeem" },
    include: { balance: true },
  });

  for (const entry of packageEntries) {
    if (!entry.balance || entry.balance.workspaceId !== workspaceId) continue;
    const delta = (entry.delta || {}) as Record<string, number>;
    const remaining = (entry.balance.remainingCredits || {}) as Record<string, number>;
    const next = { ...remaining };
    for (const [key, value] of Object.entries(delta)) {
      next[key] = (next[key] || 0) - value;
    }
    await prisma.packageBalance.update({
      where: { id: entry.balanceId },
      data: { remainingCredits: next, status: "active" },
    });
    await prisma.packageLedgerEntry.create({
      data: {
        balanceId: entry.balanceId,
        kind: "restore",
        delta: Object.fromEntries(Object.entries(delta).map(([k, v]) => [k, -v])),
        appointmentId,
        note: `Restored after appointment ${appointmentId} canceled`,
      },
    });
  }

  const giftEntries = await prisma.giftCertificateLedgerEntry.findMany({
    where: { appointmentId, kind: "redeem" },
    include: { balance: true },
  });

  for (const entry of giftEntries) {
    if (!entry.balance || entry.balance.workspaceId !== workspaceId) continue;
    const restored = Math.abs(entry.amountCents || 0);
    const nextBalance = (entry.balance.balanceCents || 0) + restored;
    await prisma.giftCertificateBalance.update({
      where: { id: entry.balanceId },
      data: { balanceCents: nextBalance, status: "active" },
    });
    await prisma.giftCertificateLedgerEntry.create({
      data: {
        balanceId: entry.balanceId,
        kind: "restore",
        amountCents: restored,
        appointmentId,
      },
    });
  }

  return {
    packageRestored: packageEntries.length,
    giftRestored: giftEntries.length,
  };
}

export async function markAppointmentPaidByEntitlement(
  workspaceId: string,
  appointmentId: string,
  detail: {
    method: "package" | "gift";
    amountCentsWaived: number;
    packageBalanceId?: string;
    giftBalanceId?: string;
    giftCode?: string;
  },
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;

  const { appendTimeline } = await import("@/lib/appointments/settings");
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const label =
    detail.method === "package"
      ? "Paid with package credit"
      : `Paid with gift certificate${detail.giftCode ? ` (${detail.giftCode})` : ""}`;

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: row.status === "pending_payment" ? "awaiting_confirmation" : row.status,
      metadata: appendTimeline(
        {
          ...meta,
          paymentStatus: "succeeded",
          paymentProvider: detail.method,
          paymentAmountCents: detail.amountCentsWaived,
          entitlementPayment: {
            method: detail.method,
            packageBalanceId: detail.packageBalanceId,
            giftBalanceId: detail.giftBalanceId,
            giftCode: detail.giftCode,
            amountCentsWaived: detail.amountCentsWaived,
          },
        },
        { type: "entitlement_payment", label },
      ) as object,
    },
  });
}
