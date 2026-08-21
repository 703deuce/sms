import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { getOrCreateStripeCustomer } from "@/lib/settings/billing";
import { getStripe } from "@/lib/stripe/client";

export type PremiumNumberCheckoutSessionInput = {
  workspaceId: string;
  userId: string;
  reservationId: string;
  phoneNumber: string;
  amountCents: number;
  vanityDisplay?: string | null;
  successUrl?: string;
  cancelUrl?: string;
};

/**
 * Creates a Stripe Checkout Session for a one-time premium number purchase.
 * Metadata must stay in sync with stripe-number-purchase-webhook.ts routing.
 */
export async function createPremiumNumberCheckoutSession(
  input: PremiumNumberCheckoutSessionInput,
): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");
  if (!Number.isFinite(input.amountCents) || input.amountCents < 50) {
    throw new Error("amountCents must be at least 50");
  }

  const customerId = await getOrCreateStripeCustomer(input.workspaceId);
  const base = getAppBaseUrl();
  const label = input.vanityDisplay?.trim() || input.phoneNumber;
  const amountCents = Math.round(input.amountCents);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: { name: `Premium number ${label}` },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    success_url:
      input.successUrl ||
      `${base}/personal/numbers/premium?reservation=${encodeURIComponent(input.reservationId)}&paid=1`,
    cancel_url:
      input.cancelUrl ||
      `${base}/personal/numbers/premium?reservation=${encodeURIComponent(input.reservationId)}&canceled=1`,
    metadata: {
      type: "premium_number",
      workspaceId: input.workspaceId,
      userId: input.userId,
      reservationId: input.reservationId,
      phoneNumber: input.phoneNumber,
      amountCents: String(amountCents),
    },
    payment_intent_data: {
      metadata: {
        type: "premium_number",
        workspaceId: input.workspaceId,
        userId: input.userId,
        reservationId: input.reservationId,
        phoneNumber: input.phoneNumber,
        amountCents: String(amountCents),
      },
    },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}
