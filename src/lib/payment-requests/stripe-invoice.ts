import "server-only";

import { getOrCreateStripeCustomerForContact } from "@/lib/merchant-payments/saved-cards";
import { getStripe } from "@/lib/stripe/client";
import { PAYMENT_REQUEST_TRANSACTION_TYPE } from "@/lib/payment-requests/types";
import { createAndSendDirectChargeInvoice } from "@/lib/stripe-connect/invoice";
import { getStripeTextToPayCapabilities } from "@/lib/stripe-connect/capabilities";

export type CreatePaymentRequestInvoiceInput = {
  workspaceId: string;
  paymentRequestId: string;
  amountMinor: number;
  currency: string;
  description: string;
  sourceType: string;
  customerPhoneE164: string;
  customerName?: string | null;
  customerEmail?: string | null;
  contactId?: string | null;
  conversationId?: string | null;
  appointmentId?: string | null;
  publicToken: string;
};

export async function createPaymentRequestStripeInvoice(
  input: CreatePaymentRequestInvoiceInput,
): Promise<
  | {
      invoiceId: string;
      hostedInvoiceUrl: string | null;
      connectedAccountId: string;
      stripeCustomerId: string;
    }
  | { error: string }
> {
  const caps = await getStripeTextToPayCapabilities(input.workspaceId);
  if (!caps.canCreateCheckoutSession || !caps.accountId) {
    return {
      error:
        caps.health === "STRIPE_CONNECTED_NOT_PAYMENT_READY"
          ? "Stripe account cannot accept payments yet — complete onboarding"
          : "Stripe is not connected for this business",
    };
  }

  let stripeCustomerId: string;
  if (input.contactId) {
    stripeCustomerId = await getOrCreateStripeCustomerForContact(
      input.workspaceId,
      input.contactId,
      input.customerEmail || undefined,
    );
  } else {
    const stripe = getStripe();
    if (!stripe) return { error: "Stripe is not configured" };
    const customer = await stripe.customers.create(
      {
        phone: input.customerPhoneE164,
        name: input.customerName || undefined,
        email: input.customerEmail || undefined,
        metadata: {
          workspace_id: input.workspaceId,
          transovo_payment_request_id: input.paymentRequestId,
        },
      },
      { stripeAccount: caps.accountId },
    );
    stripeCustomerId = customer.id;
  }

  let invoice;
  try {
    invoice = await createAndSendDirectChargeInvoice({
    connectedAccountId: caps.accountId,
    customerId: stripeCustomerId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    description: input.description,
    metadata: {
      transaction_type: PAYMENT_REQUEST_TRANSACTION_TYPE,
      transovo_payment_request_id: input.paymentRequestId,
      workspace_id: input.workspaceId,
      source_type: input.sourceType,
      ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
      ...(input.appointmentId ? { appointment_id: input.appointmentId } : {}),
    },
    idempotencyKey: `t2p-invoice:${input.paymentRequestId}`,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invoice creation failed" };
  }

  return {
    invoiceId: invoice.invoiceId,
    hostedInvoiceUrl: invoice.hostedInvoiceUrl,
    connectedAccountId: caps.accountId,
    stripeCustomerId,
  };
}
