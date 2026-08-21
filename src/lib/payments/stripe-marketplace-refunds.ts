import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";

export type IssueMarketplaceRefundInput = {
  workspaceId: string;
  reservationId?: string;
  phoneNumberId?: string;
  stripePaymentIntentId: string;
  amountCents: number;
  reason: string;
};

export async function issueMarketplaceStripeRefund(input: IssueMarketplaceRefundInput) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const prisma = getPrisma();

  const existing = await prisma.marketplaceStripeRefund.findFirst({
    where: {
      stripePaymentIntentId: input.stripePaymentIntentId,
      amountCents: input.amountCents,
      reason: input.reason,
    },
  });
  if (existing) return existing;

  const refund = await stripe.refunds.create({
    payment_intent: input.stripePaymentIntentId,
    amount: input.amountCents,
    metadata: {
      reason: input.reason.slice(0, 500),
      reservationId: input.reservationId ?? "",
      workspaceId: input.workspaceId,
    },
  });

  try {
    return await prisma.marketplaceStripeRefund.create({
      data: {
        workspaceId: input.workspaceId,
        reservationId: input.reservationId ?? null,
        phoneNumberId: input.phoneNumberId ?? null,
        stripePaymentIntentId: input.stripePaymentIntentId,
        stripeRefundId: refund.id,
        amountCents: input.amountCents,
        reason: input.reason,
        status: refund.status ?? "succeeded",
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
      return prisma.marketplaceStripeRefund.findUniqueOrThrow({
        where: { stripeRefundId: refund.id },
      });
    }
    throw err;
  }
}

export async function refundPremiumNumberPurchase(input: {
  workspaceId: string;
  reservationId: string;
  stripePaymentIntentId: string;
  amountCents: number;
  reason: string;
}) {
  const prisma = getPrisma();
  const refund = await issueMarketplaceStripeRefund({
    workspaceId: input.workspaceId,
    reservationId: input.reservationId,
    stripePaymentIntentId: input.stripePaymentIntentId,
    amountCents: input.amountCents,
    reason: input.reason,
  });

  await prisma.premiumNumberReservation.updateMany({
    where: { id: input.reservationId, workspaceId: input.workspaceId },
    data: {
      stripeRefundId: refund.stripeRefundId,
      paymentStatus: "refunded",
      fulfillmentStatus: "failed",
      orderStatus: "refunded",
    },
  });

  return refund;
}
