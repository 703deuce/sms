import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { STRIPE_TEXT_TO_PAY_CHARGE_MODEL } from "@/lib/stripe-connect/constants";
import { normalizeStripeSdkError } from "@/lib/stripe-connect/errors";

export type DirectChargeCheckoutInput = {
  connectedAccountId: string;
  mode: "payment";
  successUrl: string;
  cancelUrl: string;
  lineItems: Stripe.Checkout.SessionCreateParams.LineItem[];
  metadata: Record<string, string>;
  customerEmail?: string | null;
  idempotencyKey?: string;
};

/**
 * ST-CHK-001 — direct charge Checkout Session on connected account.
 * Uses platform Stripe client + stripeAccount (Stripe-Account header).
 */
export async function createDirectChargeCheckoutSession(
  input: DirectChargeCheckoutInput,
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  if (!stripe) {
    throw normalizeStripeSdkError(new Error("Stripe platform is not configured"), "checkout.sessions.create");
  }
  if (!input.connectedAccountId.startsWith("acct_")) {
    throw normalizeStripeSdkError(
      new Error("Invalid connected account id"),
      "checkout.sessions.create",
    );
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: input.mode,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    line_items: input.lineItems,
    metadata: {
      ...input.metadata,
      stripe_charge_model: STRIPE_TEXT_TO_PAY_CHARGE_MODEL,
    },
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
  };

  try {
    return await stripe.checkout.sessions.create(params, {
      stripeAccount: input.connectedAccountId,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });
  } catch (err) {
    throw normalizeStripeSdkError(err, "checkout.sessions.create");
  }
}
