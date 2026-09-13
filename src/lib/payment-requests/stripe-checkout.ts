import "server-only";

import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import { getMerchantConnection, refreshStripeConnectAccount } from "@/lib/merchant-payments/connection-store";
import { PAYMENT_REQUEST_TRANSACTION_TYPE, isPaymentRequestCheckoutMetadata } from "@/lib/payment-requests/types";
import { createDirectChargeCheckoutSession } from "@/lib/stripe-connect/checkout";
import { getStripeTextToPayCapabilities } from "@/lib/stripe-connect/capabilities";

export { isPaymentRequestCheckoutMetadata };

export type CreatePaymentRequestCheckoutInput = {
  workspaceId: string;
  paymentRequestId: string;
  amountMinor: number;
  currency: string;
  description: string;
  sourceType: string;
  conversationId?: string | null;
  appointmentId?: string | null;
  publicToken: string;
};

export async function createPaymentRequestStripeCheckout(
  input: CreatePaymentRequestCheckoutInput,
): Promise<{ sessionId: string; url: string; connectedAccountId: string } | { error: string }> {
  const caps = await getStripeTextToPayCapabilities(input.workspaceId);
  if (!caps.canCreateCheckoutSession || !caps.accountId) {
    return {
      error:
        caps.health === "STRIPE_CONNECTED_NOT_PAYMENT_READY"
          ? "Stripe account cannot accept payments yet — complete onboarding"
          : "Stripe is not connected for this business",
    };
  }

  const connection = await getMerchantConnection(input.workspaceId, "STRIPE");
  if (!connection?.merchantAccountId) {
    return { error: "Stripe is not connected for this business" };
  }
  await refreshStripeConnectAccount(input.workspaceId, connection);

  const base = getAppBaseUrl().replace(/\/$/, "");
  const session = await createDirectChargeCheckoutSession({
    connectedAccountId: caps.accountId,
    mode: "payment",
    success_url: `${base}/p/${input.publicToken}?return=1`,
    cancel_url: `${base}/p/${input.publicToken}?canceled=1`,
    lineItems: [
      {
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.amountMinor,
          product_data: { name: input.description },
        },
      },
    ],
    metadata: {
      transaction_type: PAYMENT_REQUEST_TRANSACTION_TYPE,
      transovo_payment_request_id: input.paymentRequestId,
      workspace_id: input.workspaceId,
      source_type: input.sourceType,
      ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      ...(input.appointmentId ? { appointment_id: input.appointmentId } : {}),
    },
    idempotencyKey: `t2p-checkout:${input.paymentRequestId}`,
  });

  if (!session.url) return { error: "Stripe did not return a checkout URL" };

  return {
    sessionId: session.id,
    url: session.url,
    connectedAccountId: caps.accountId,
  };
}
