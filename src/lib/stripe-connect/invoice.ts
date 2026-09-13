import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { STRIPE_TEXT_TO_PAY_CHARGE_MODEL } from "@/lib/stripe-connect/constants";
import { normalizeStripeSdkError } from "@/lib/stripe-connect/errors";

export type DirectChargeInvoiceInput = {
  connectedAccountId: string;
  customerId: string;
  amountMinor: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  daysUntilDue?: number;
  idempotencyKey?: string;
};

/**
 * ST-INV-001 — Send Invoice on connected account (direct charge model).
 * Customer + Invoice objects live on the connected account.
 */
export async function createAndSendDirectChargeInvoice(
  input: DirectChargeInvoiceInput,
): Promise<{ invoiceId: string; hostedInvoiceUrl: string | null; status: string }> {
  const stripe = getStripe();
  if (!stripe) {
    throw normalizeStripeSdkError(new Error("Stripe platform is not configured"), "invoices.create");
  }
  if (!input.connectedAccountId.startsWith("acct_")) {
    throw normalizeStripeSdkError(new Error("Invalid connected account id"), "invoices.create");
  }

  const stripeOpts = {
    stripeAccount: input.connectedAccountId,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };

  try {
    await stripe.invoiceItems.create(
      {
        customer: input.customerId,
        amount: input.amountMinor,
        currency: input.currency.toLowerCase(),
        description: input.description,
      },
      stripeOpts,
    );

    const invoice = await stripe.invoices.create(
      {
        customer: input.customerId,
        collection_method: "send_invoice",
        days_until_due: input.daysUntilDue ?? 7,
        metadata: {
          ...input.metadata,
          stripe_charge_model: STRIPE_TEXT_TO_PAY_CHARGE_MODEL,
        },
      },
      stripeOpts,
    );

    const finalized = await stripe.invoices.finalizeInvoice(invoice.id, stripeOpts);
    const sent = await stripe.invoices.sendInvoice(finalized.id, stripeOpts);

    return {
      invoiceId: sent.id,
      hostedInvoiceUrl: sent.hosted_invoice_url ?? null,
      status: sent.status || "open",
    };
  } catch (err) {
    throw normalizeStripeSdkError(err, "invoices.create");
  }
}

export function isStripeInvoicePaid(invoice: Pick<Stripe.Invoice, "status" | "paid">): boolean {
  return invoice.status === "paid" || invoice.paid === true;
}
