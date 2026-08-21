import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
import { completePremiumPurchase } from "@/lib/numbers/purchase-service";
import { emitMarketplaceAlert } from "@/lib/ops/marketplace-alerts";
import { recordPremiumNumberStripePayment } from "@/lib/payments/stripe-number-payment-ledger";

export function isPremiumNumberCheckoutMetadata(
  metadata: Record<string, string | undefined> | null | undefined,
): boolean {
  const type = metadata?.type?.trim().toLowerCase();
  return type === "premium_number" || type === "number_purchase";
}

function paymentIntentIdFromSession(session: Stripe.Checkout.Session): string | null {
  return typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id || null;
}

function paymentIntentIdFromIntent(intent: Stripe.PaymentIntent): string {
  return intent.id;
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
    data: { paymentStatus: "failed", orderStatus: "none" },
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

export async function handlePremiumNumberCheckoutSession(session: Stripe.Checkout.Session) {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const reservationId = metadata.reservationId?.trim();
  const workspaceId = metadata.workspaceId?.trim();
  const userId = metadata.userId?.trim();

  if (!reservationId || !workspaceId || !userId) {
    throw new Error(
      "premium_number checkout.session missing reservationId, workspaceId, or userId metadata",
    );
  }

  if (!sessionIsPaid(session)) {
    return { skipped: true, reason: "payment_not_completed" as const };
  }

  const stripeSessionId = session.id;
  const stripePaymentIntentId = paymentIntentIdFromSession(session);
  const amountCents = Number(metadata.amountCents || session.amount_total || 0);

  const reservation = await getPrisma().premiumNumberReservation.findFirst({
    where: { id: reservationId, workspaceId },
  });
  if (!reservation) {
    throw new Error(`Reservation not found for premium_number checkout: ${reservationId}`);
  }

  await recordPremiumNumberStripePayment({
    workspaceId,
    reservationId,
    phoneNumber: reservation.phoneNumber,
    amountCents: amountCents > 0 ? amountCents : reservation.premiumPriceCents,
    stripeSessionId,
    stripePaymentIntentId,
  });

  const result = await completePremiumPurchase({
    workspaceId,
    userId,
    reservationId,
    idempotencyKey: `stripe:${stripeSessionId}`,
    confirmedStripePayment: {
      paymentId: stripePaymentIntentId || stripeSessionId,
      stripeSessionId,
      stripePaymentIntentId,
    },
  });

  if (!result.ok && result.status !== "already_completed" && result.status !== "purchase_in_progress") {
    await emitMarketplaceAlert({
      severity: "critical",
      category: "number_purchase_failed",
      message: "Stripe webhook could not complete premium number purchase",
      workspaceId,
      userId,
      reservationId,
      phoneNumber: reservation.phoneNumber,
      error: result.error || result.status,
    });
    throw new Error(result.error || result.status);
  }

  return { ok: true, status: result.status, phoneNumberId: result.phoneNumberId };
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
  if (!isPremiumNumberCheckoutMetadata(metadata)) {
    return { skipped: true as const, reason: "not_premium_number" as const };
  }

  const reservationId = metadata.reservationId?.trim();
  const workspaceId = metadata.workspaceId?.trim();
  const userId = metadata.userId?.trim();
  if (!reservationId || !workspaceId || !userId) {
    throw new Error("premium_number payment_intent missing reservationId, workspaceId, or userId metadata");
  }

  const stripePaymentIntentId = paymentIntentIdFromIntent(intent);
  const reservation = await getPrisma().premiumNumberReservation.findFirst({
    where: { id: reservationId, workspaceId },
  });
  if (!reservation) {
    throw new Error(`Reservation not found for premium_number payment_intent: ${reservationId}`);
  }

  if (reservation.paymentStatus === "paid" && reservation.phoneNumberId) {
    return { ok: true, status: "already_completed" as const };
  }

  const stripeSessionId = metadata.stripeSessionId?.trim() || `pi:${stripePaymentIntentId}`;

  await recordPremiumNumberStripePayment({
    workspaceId,
    reservationId,
    phoneNumber: reservation.phoneNumber,
    amountCents: Number(metadata.amountCents || intent.amount_received || reservation.premiumPriceCents),
    stripeSessionId,
    stripePaymentIntentId,
  });

  const result = await completePremiumPurchase({
    workspaceId,
    userId,
    reservationId,
    idempotencyKey: `stripe:${stripePaymentIntentId}`,
    confirmedStripePayment: {
      paymentId: stripePaymentIntentId,
      stripeSessionId,
      stripePaymentIntentId,
    },
  });

  if (!result.ok && result.status !== "already_completed" && result.status !== "purchase_in_progress") {
    throw new Error(result.error || result.status);
  }

  return { ok: true, status: result.status };
}

export async function handlePremiumNumberPaymentIntentFailed(intent: Stripe.PaymentIntent) {
  const metadata = (intent.metadata || {}) as Record<string, string>;
  if (!isPremiumNumberCheckoutMetadata(metadata)) return { skipped: true as const };

  const reservationId = metadata.reservationId?.trim();
  if (!reservationId) return { skipped: true as const };

  await markReservationPaymentFailed({
    reservationId,
    workspaceId: metadata.workspaceId?.trim(),
    reason: intent.last_payment_error?.message || "payment_intent_failed",
  });
  return { ok: true as const };
}
