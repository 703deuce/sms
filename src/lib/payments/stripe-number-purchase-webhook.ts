import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
import { completePremiumPurchase } from "@/lib/numbers/purchase-service";
import { emitMarketplaceAlert } from "@/lib/ops/marketplace-alerts";
import { recordPremiumNumberStripePayment } from "@/lib/payments/stripe-number-payment-ledger";
import { refundPremiumNumberPurchase } from "@/lib/payments/stripe-marketplace-refunds";
import { isMarketplaceNumberPurchaseMetadata } from "@/lib/payments/stripe-marketplace-metadata";

export function isPremiumNumberCheckoutMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): boolean {
  return isMarketplaceNumberPurchaseMetadata(metadata);
}

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;
}

function sessionIsPaid(session: Stripe.Checkout.Session): boolean {
  return session.payment_status === "paid" || session.payment_status === "no_payment_required";
}

async function markReservationPaymentFailed(input: {
  reservationId: string;
  workspaceId?: string;
  reason: string;
}) {
  const prisma = getPrisma();
  await prisma.premiumNumberReservation.updateMany({
    where: {
      id: input.reservationId,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      paymentStatus: { in: ["none", "processing", "failed"] },
    },
    data: { paymentStatus: "failed", orderStatus: "none", fulfillmentStatus: "failed" },
  });
  await emitMarketplaceAlert({
    severity: "critical",
    category: "payment_failed",
    message: "Stripe number purchase payment failed",
    reservationId: input.reservationId,
    workspaceId: input.workspaceId,
    error: input.reason,
  });
}

function verifyReservationAmount(reservation: { premiumPriceCents: number }, amountCents: number) {
  if (amountCents > 0 && amountCents !== reservation.premiumPriceCents) {
    throw new Error(
      `Payment amount mismatch: expected ${reservation.premiumPriceCents}, received ${amountCents}`,
    );
  }
}

async function fulfillPaidReservation(input: {
  sessionOrIntentId: string;
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  amountCents: number;
  reservationId: string;
  workspaceId: string;
  userId: string;
}) {
  const prisma = getPrisma();
  const reservation = await prisma.premiumNumberReservation.findFirst({
    where: { id: input.reservationId, workspaceId: input.workspaceId },
  });
  if (!reservation) {
    throw new Error(`Reservation not found for marketplace_number_purchase: ${input.reservationId}`);
  }

  if (reservation.paymentStatus === "paid" && reservation.phoneNumberId) {
    return { ok: true, status: "already_completed" as const, phoneNumberId: reservation.phoneNumberId };
  }

  verifyReservationAmount(reservation, input.amountCents);

  await recordPremiumNumberStripePayment({
    workspaceId: input.workspaceId,
    reservationId: input.reservationId,
    phoneNumber: reservation.phoneNumber,
    amountCents: reservation.premiumPriceCents,
    stripeSessionId: input.stripeSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId,
  });

  await prisma.premiumNumberReservation.update({
    where: { id: reservation.id },
    data: {
      stripeSessionId: input.stripeSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      fulfillmentStatus: "pending",
    },
  });

  const result = await completePremiumPurchase({
    workspaceId: input.workspaceId,
    userId: input.userId,
    reservationId: input.reservationId,
    idempotencyKey: `stripe:${input.sessionOrIntentId}`,
    confirmedStripePayment: {
      paymentId: input.stripePaymentIntentId || input.stripeSessionId,
      stripeSessionId: input.stripeSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
    },
  });

  if (result.ok) {
    await prisma.premiumNumberReservation.update({
      where: { id: reservation.id },
      data: { fulfillmentStatus: "fulfilled" },
    });
    return result;
  }

  if (result.status === "already_completed" || result.status === "purchase_in_progress") {
    return result;
  }

  await prisma.premiumNumberReservation.update({
    where: { id: reservation.id },
    data: { fulfillmentStatus: "failed" },
  });

  if (
    input.stripePaymentIntentId &&
    ["provider_failed", "sold", "payment_failed"].includes(result.status)
  ) {
    try {
      await refundPremiumNumberPurchase({
        workspaceId: input.workspaceId,
        reservationId: input.reservationId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        amountCents: reservation.premiumPriceCents,
        reason: result.error || result.status,
      });
    } catch (refundErr) {
      await emitMarketplaceAlert({
        severity: "critical",
        category: "payment_failed",
        message: "Automatic refund failed after number acquisition failure",
        workspaceId: input.workspaceId,
        reservationId: input.reservationId,
        phoneNumber: reservation.phoneNumber,
        error: refundErr instanceof Error ? refundErr.message : "Refund failed",
      });
    }
  }

  await emitMarketplaceAlert({
    severity: "critical",
    category: "number_purchase_failed",
    message: "Stripe webhook could not complete premium number purchase",
    workspaceId: input.workspaceId,
    userId: input.userId,
    reservationId: input.reservationId,
    phoneNumber: reservation.phoneNumber,
    error: result.error || result.status,
  });
  throw new Error(result.error || result.status);
}

export async function handlePremiumNumberCheckoutSession(session: Stripe.Checkout.Session) {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const reservationId = metadata.reservationId?.trim();
  const workspaceId = metadata.workspaceId?.trim();
  const userId = metadata.userId?.trim();

  if (!reservationId || !workspaceId || !userId) {
    throw new Error(
      "marketplace_number_purchase checkout.session missing reservationId, workspaceId, or userId metadata",
    );
  }

  if (!sessionIsPaid(session)) {
    return { skipped: true, reason: "payment_not_completed" as const };
  }

  const amountCents = Number(metadata.amountCents || session.amount_total || 0);
  return fulfillPaidReservation({
    sessionOrIntentId: session.id,
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentIdFromSession(session),
    amountCents,
    reservationId,
    workspaceId,
    userId,
  });
}

export async function handlePremiumNumberCheckoutFailed(session: Stripe.Checkout.Session) {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const reservationId = metadata.reservationId?.trim();
  if (!reservationId) return { skipped: true as const };

  await markReservationPaymentFailed({
    reservationId,
    workspaceId: metadata.workspaceId?.trim(),
    reason: session.payment_status || "checkout_failed",
  });
  return { ok: true as const };
}

export async function handlePremiumNumberPaymentIntentSucceeded(intent: Stripe.PaymentIntent) {
  const metadata = (intent.metadata || {}) as Record<string, string>;
  if (!isMarketplaceNumberPurchaseMetadata(metadata)) {
    return { skipped: true as const, reason: "not_marketplace_number_purchase" as const };
  }

  const reservationId = metadata.reservationId?.trim();
  const workspaceId = metadata.workspaceId?.trim();
  const userId = metadata.userId?.trim();
  if (!reservationId || !workspaceId || !userId) {
    throw new Error("marketplace_number_purchase payment_intent missing reservation metadata");
  }

  const stripePaymentIntentId = intent.id;
  const stripeSessionId = metadata.stripeSessionId?.trim() || `pi:${stripePaymentIntentId}`;
  const amountCents = Number(metadata.amountCents || intent.amount_received || 0);

  return fulfillPaidReservation({
    sessionOrIntentId: stripePaymentIntentId,
    stripeSessionId,
    stripePaymentIntentId,
    amountCents,
    reservationId,
    workspaceId,
    userId,
  });
}

export async function handlePremiumNumberPaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const metadata = (intent.metadata || {}) as Record<string, string>;
  if (!isMarketplaceNumberPurchaseMetadata(metadata)) return { skipped: true as const };

  const reservationId = metadata.reservationId?.trim();
  if (!reservationId) return { skipped: true as const };

  await markReservationPaymentFailed({
    reservationId,
    workspaceId: metadata.workspaceId?.trim(),
    reason: intent.last_payment_error?.message || "payment_intent_failed",
  });
  return { ok: true as const };
}
