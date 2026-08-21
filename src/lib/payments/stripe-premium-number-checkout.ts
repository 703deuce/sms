import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { getPrisma } from "@/lib/db";
import { buildNumberPurchaseMetadata } from "@/lib/payments/stripe-marketplace-metadata";
import { getOrCreateStripeCustomer } from "@/lib/settings/billing";
import { getStripe } from "@/lib/stripe/client";

export type PremiumNumberCheckoutSessionInput = {
  workspaceId: string;
  userId: string;
  reservationId: string;
  successUrl?: string;
  cancelUrl?: string;
};

/**
 * Creates a one-time Stripe Checkout Session using the authoritative reservation price.
 * Never accepts amount from the client.
 */
export async function createPremiumNumberCheckoutSessionFromReservation(
  input: PremiumNumberCheckoutSessionInput,
): Promise<{ url: string; sessionId: string; amountCents: number }> {
  const prisma = getPrisma();
  const reservation = await prisma.premiumNumberReservation.findFirst({
    where: { id: input.reservationId, workspaceId: input.workspaceId, userId: input.userId },
  });
  if (!reservation) throw new Error("Reservation not found");
  if (reservation.reservationStatus !== "reserved" && reservation.reservationStatus !== "active") {
    throw new Error(`Reservation is ${reservation.reservationStatus}`);
  }
  if (reservation.reservationExpiresAt && reservation.reservationExpiresAt < new Date()) {
    throw new Error("Reservation expired — search again");
  }
  if (reservation.paymentStatus === "paid") {
    throw new Error("Reservation already paid");
  }

  const amountCents = reservation.premiumPriceCents;
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");

  const customerId = await getOrCreateStripeCustomer(input.workspaceId);
  const base = getAppBaseUrl();
  const label = reservation.vanityDisplay?.trim() || reservation.displayNumber || reservation.phoneNumber;
  const metadata = buildNumberPurchaseMetadata({
    workspaceId: input.workspaceId,
    userId: input.userId,
    reservationId: reservation.id,
    phoneNumber: reservation.phoneNumber,
    amountCents,
    provider: reservation.provider,
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Phone number ${label}`,
            description: "One-time phone number purchase",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url:
      input.successUrl ||
      `${base}/personal/numbers/premium?reservation=${encodeURIComponent(reservation.id)}&paid=1`,
    cancel_url:
      input.cancelUrl ||
      `${base}/personal/numbers/premium?reservation=${encodeURIComponent(reservation.id)}&canceled=1`,
    metadata,
    payment_intent_data: { metadata },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  await prisma.premiumNumberReservation.update({
    where: { id: reservation.id },
    data: {
      stripeSessionId: session.id,
      fulfillmentStatus: "pending",
    },
  });

  return { url: session.url, sessionId: session.id, amountCents };
}

/** @deprecated Prefer createPremiumNumberCheckoutSessionFromReservation */
export async function createPremiumNumberCheckoutSession(input: {
  workspaceId: string;
  userId: string;
  reservationId: string;
  phoneNumber: string;
  amountCents: number;
  vanityDisplay?: string | null;
  successUrl?: string;
  cancelUrl?: string;
}) {
  return createPremiumNumberCheckoutSessionFromReservation({
    workspaceId: input.workspaceId,
    userId: input.userId,
    reservationId: input.reservationId,
    successUrl: input.successUrl,
    cancelUrl: input.cancelUrl,
  });
}
