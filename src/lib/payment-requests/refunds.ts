import "server-only";

import { getPrisma } from "@/lib/db";
import { createDirectChargeRefund } from "@/lib/stripe-connect/refunds";
import { recordPaymentRequestEvent } from "@/lib/payment-requests/events";

export async function refundPaymentRequest(input: {
  workspaceId: string;
  paymentRequestId: string;
  amountMinor?: number;
  reason?: string;
  userId?: string;
}) {
  const prisma = getPrisma();
  const row = await prisma.paymentRequest.findFirst({
    where: { id: input.paymentRequestId, workspaceId: input.workspaceId },
  });
  if (!row) throw new Error("Payment request not found");
  if (row.status !== "paid" && row.status !== "partially_refunded") {
    throw new Error("Only paid requests can be refunded");
  }
  if (!row.processorConnectedAccountId) {
    throw new Error("Missing connected account on payment request");
  }

  const paidMinor = row.amountPaidMinor ?? row.amountMinor;
  const alreadyRefunded = row.amountRefundedMinor ?? 0;
  const remaining = paidMinor - alreadyRefunded;
  if (remaining <= 0) throw new Error("Nothing left to refund");

  const refundMinor = input.amountMinor ?? remaining;
  if (refundMinor <= 0 || refundMinor > remaining) {
    throw new Error("Invalid refund amount");
  }

  const refund = await createDirectChargeRefund({
    connectedAccountId: row.processorConnectedAccountId,
    paymentIntentId: row.processorPaymentIntentId,
    chargeId: row.processorChargeId,
    amountMinor: refundMinor,
    reason: "requested_by_customer",
    idempotencyKey: `t2p-refund:${row.id}:${refundMinor}:${alreadyRefunded}`,
  });

  const ledger = await prisma.paymentRequestRefund.create({
    data: {
      workspaceId: input.workspaceId,
      paymentRequestId: row.id,
      stripeConnectedAccountId: row.processorConnectedAccountId,
      stripeRefundId: refund.id,
      stripePaymentIntentId: row.processorPaymentIntentId,
      stripeChargeId: typeof refund.charge === "string" ? refund.charge : row.processorChargeId,
      amountMinor: refundMinor,
      currency: row.currency,
      status: refund.status || "succeeded",
      reason: input.reason || null,
      refundApplicationFee: null,
      completedAt: refund.status === "succeeded" ? new Date() : null,
    },
  });

  const newRefundedTotal = alreadyRefunded + refundMinor;
  const nextStatus = newRefundedTotal >= paidMinor ? "refunded" : "partially_refunded";

  const updated = await prisma.paymentRequest.update({
    where: { id: row.id },
    data: {
      status: nextStatus,
      amountRefundedMinor: newRefundedTotal,
      refundedAt: nextStatus === "refunded" ? new Date() : row.refundedAt,
    },
  });

  await recordPaymentRequestEvent({
    paymentRequestId: row.id,
    workspaceId: input.workspaceId,
    eventType: "refund_issued",
    actorType: input.userId ? "user" : "system",
    actorUserId: input.userId,
    payload: {
      refundId: ledger.id,
      stripeRefundId: refund.id,
      amountMinor: refundMinor,
      status: nextStatus,
    },
  });

  return { request: updated, refund: ledger };
}
