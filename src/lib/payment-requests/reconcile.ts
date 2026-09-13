import "server-only";

import type { PaymentRequest } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { recordPaymentRequestEvent } from "@/lib/payment-requests/events";

export type ReconcilePaymentRequestPaidInput = {
  paymentRequestId: string;
  workspaceId: string;
  source: "checkout_session" | "checkout_async" | "invoice";
  amountMinor: number;
  processorCheckoutId?: string | null;
  processorInvoiceId?: string | null;
  processorPaymentIntentId?: string | null;
  processorChargeId?: string | null;
  stripeEventId?: string | null;
};

/**
 * Single canonical PAID transition — prevents duplicate PAYMENT_CONFIRMED / payment_received.
 */
export async function reconcilePaymentRequestPaid(
  input: ReconcilePaymentRequestPaidInput,
): Promise<{ updated: boolean; duplicate: boolean; row: PaymentRequest | null }> {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findFirst({
    where: { id: input.paymentRequestId, workspaceId: input.workspaceId },
  });
  if (!row) return { updated: false, duplicate: false, row: null };

  if (row.status === "paid" || row.status === "refunded" || row.status === "partially_refunded") {
    return { updated: false, duplicate: true, row };
  }

  const updated = await prisma.paymentRequest.update({
    where: { id: row.id },
    data: {
      status: "paid",
      paidAt: new Date(),
      amountPaidMinor: input.amountMinor,
      processorPaymentIntentId: input.processorPaymentIntentId ?? row.processorPaymentIntentId,
      processorChargeId: input.processorChargeId ?? row.processorChargeId,
      processorCheckoutId: input.processorCheckoutId ?? row.processorCheckoutId,
      processorInvoiceId: input.processorInvoiceId ?? row.processorInvoiceId,
    },
  });

  await recordPaymentRequestEvent({
    paymentRequestId: row.id,
    workspaceId: input.workspaceId,
    eventType: "payment_received",
    actorType: "provider",
    payload: {
      source: input.source,
      stripeEventId: input.stripeEventId,
      paymentIntent: input.processorPaymentIntentId,
      invoiceId: input.processorInvoiceId,
    },
  });

  return { updated: true, duplicate: false, row: updated };
}
