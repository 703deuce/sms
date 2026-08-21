import { getPrisma } from "@/lib/db";

/**
 * Persist Stripe payment ids for premium number purchases without changing the
 * workspace credit balance. Used for port-out guarantee refunds and audit.
 */
export async function recordPremiumNumberStripePayment(input: {
  workspaceId: string;
  reservationId: string;
  phoneNumber?: string;
  amountCents: number;
  stripeSessionId: string;
  stripePaymentIntentId?: string | null;
}) {
  const prisma = getPrisma();
  const existing = await prisma.creditLedgerEntry.findFirst({
    where: { stripeSessionId: input.stripeSessionId },
  });
  if (existing) return existing;

  const recent = await prisma.creditLedgerEntry.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
  });
  const prevBalance = recent?.balanceAfterCents ?? 0;
  const phoneSuffix = input.phoneNumber ? ` (${input.phoneNumber})` : "";

  try {
    return await prisma.creditLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        amountCents: input.amountCents,
        balanceAfterCents: prevBalance,
        description: `Premium number purchase reservation ${input.reservationId}${phoneSuffix}`,
        source: "premium_number_purchase",
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return prisma.creditLedgerEntry.findFirst({ where: { stripeSessionId: input.stripeSessionId } });
    }
    throw err;
  }
}
