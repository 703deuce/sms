import "server-only";

import { getStripe } from "@/lib/stripe/client";
import { normalizeStripeSdkError } from "@/lib/stripe-connect/errors";

/** Application fees are not used for Text-to-Pay direct charges today. */
export const STRIPE_TEXT_TO_PAY_REFUND_APPLICATION_FEE_POLICY: "NOT_APPLICABLE" | boolean =
  "NOT_APPLICABLE";

export async function createDirectChargeRefund(input: {
  connectedAccountId: string;
  paymentIntentId?: string | null;
  chargeId?: string | null;
  amountMinor?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  idempotencyKey?: string;
}) {
  const stripe = getStripe();
  if (!stripe) {
    throw normalizeStripeSdkError(new Error("Stripe platform is not configured"), "refunds.create");
  }
  if (!input.connectedAccountId.startsWith("acct_")) {
    throw normalizeStripeSdkError(new Error("Invalid connected account id"), "refunds.create");
  }

  const params: {
    payment_intent?: string;
    charge?: string;
    amount?: number;
    reason?: "duplicate" | "fraudulent" | "requested_by_customer";
    refund_application_fee?: boolean;
  } = {};

  if (input.paymentIntentId) params.payment_intent = input.paymentIntentId;
  else if (input.chargeId) params.charge = input.chargeId;
  else throw normalizeStripeSdkError(new Error("payment_intent or charge required"), "refunds.create");

  if (input.amountMinor != null) params.amount = input.amountMinor;
  if (input.reason) params.reason = input.reason;

  if (STRIPE_TEXT_TO_PAY_REFUND_APPLICATION_FEE_POLICY !== "NOT_APPLICABLE") {
    params.refund_application_fee = STRIPE_TEXT_TO_PAY_REFUND_APPLICATION_FEE_POLICY === true;
  }

  try {
    return await stripe.refunds.create(params, {
      stripeAccount: input.connectedAccountId,
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });
  } catch (err) {
    throw normalizeStripeSdkError(err, "refunds.create");
  }
}
