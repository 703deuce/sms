import "server-only";

import { getPrisma } from "@/lib/db";
import { appendTimeline } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { PAYMENT_HOLD_MINUTES } from "./types";
import type { PaymentRecord } from "./payment-record-store";
import type { MerchantPaymentProvider } from "./types";

export function paymentHoldExpiresAt(): Date {
  return new Date(Date.now() + PAYMENT_HOLD_MINUTES * 60_000);
}

export async function syncAppointmentPaymentMetadata(
  workspaceId: string,
  appointmentId: string,
  payment: PaymentRecord,
  extra?: Partial<AppointmentMetadata>,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;

  const meta = (row.metadata || {}) as AppointmentMetadata;
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: {
        ...meta,
        paymentStatus: payment.status,
        paymentProvider: payment.provider.toLowerCase(),
        paymentMode: payment.paymentMode,
        totalPriceCents: payment.totalPriceCents,
        paymentAmountCents: payment.amountPaidCents,
        depositPaidCents: payment.paymentMode === "deposit" ? payment.amountPaidCents : undefined,
        balanceDueCents: payment.balanceDueCents,
        merchantPaymentId: payment.id,
        providerPaymentId: payment.providerPaymentId,
        providerSessionId: payment.providerSessionId,
        refundAmountCents: payment.refundAmountCents || undefined,
        refundStatus: payment.refundStatus || undefined,
        paidAt: payment.paidAt?.toISOString(),
        ...extra,
      } as object,
    },
  });
}

export async function markAppointmentPaymentSucceeded(
  workspaceId: string,
  appointmentId: string,
  payment: PaymentRecord,
  providerPaymentId: string,
  amountPaidCents: number,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return false;

  const meta = (row.metadata || {}) as AppointmentMetadata;
  const balanceDueCents =
    payment.paymentMode === "deposit"
      ? Math.max(0, payment.totalPriceCents - amountPaidCents)
      : 0;

  const nextMeta = appendTimeline(
    {
      ...meta,
      paymentStatus: "succeeded",
      paymentProvider: payment.provider.toLowerCase() as MerchantPaymentProvider,
      paymentAmountCents: amountPaidCents,
      depositPaidCents: payment.paymentMode === "deposit" ? amountPaidCents : undefined,
      balanceDueCents,
      providerPaymentId,
      paidAt: new Date().toISOString(),
      paymentHoldExpiresAt: undefined,
    },
    {
      type: "payment_received",
      label: payment.paymentMode === "deposit" ? "Deposit received" : "Payment received",
      detail: `$${(amountPaidCents / 100).toFixed(2)}`,
    },
  ) as AppointmentMetadata;

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "awaiting_confirmation",
      metadata: nextMeta as object,
    },
  });

  try {
    const { emitWorkflowTrigger } = await import("@/lib/appointment-workflows/triggers");
    const { cancelPaymentFollowUpSteps } = await import("@/lib/appointment-workflows/engine");
    await cancelPaymentFollowUpSteps(workspaceId, appointmentId);
    await emitWorkflowTrigger({
      workspaceId,
      appointmentId,
      trigger: "payment_received",
    });
    if (payment.paymentMode === "deposit") {
      await emitWorkflowTrigger({
        workspaceId,
        appointmentId,
        trigger: "deposit_paid",
      });
      if (balanceDueCents > 0) {
        await emitWorkflowTrigger({
          workspaceId,
          appointmentId,
          trigger: "balance_due",
        });
      }
    }
  } catch {
    // optional
  }

  return true;
}

export async function markAppointmentPaymentFailed(
  workspaceId: string,
  appointmentId: string,
  reason?: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;

  const meta = appendTimeline((row.metadata || {}) as AppointmentMetadata, {
    type: "payment_failed",
    label: "Payment failed",
    detail: reason,
  }) as AppointmentMetadata;

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      metadata: { ...meta, paymentStatus: "failed" } as object,
    },
  });

  try {
    const { emitWorkflowTrigger } = await import("@/lib/appointment-workflows/triggers");
    await emitWorkflowTrigger({
      workspaceId,
      appointmentId,
      trigger: "payment_failed",
    });
    await emitWorkflowTrigger({
      workspaceId,
      appointmentId,
      trigger: "payment_required",
    });
  } catch {
    // optional
  }
}

export async function expirePendingPaymentAppointment(
  workspaceId: string,
  appointmentId: string,
) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) return;
  if (row.status !== "pending_payment") return;

  const meta = (row.metadata || {}) as AppointmentMetadata;
  if (meta.paymentStatus === "succeeded" || meta.paymentStatus === "paid") return;

  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "canceled",
      metadata: appendTimeline(
        { ...meta, paymentStatus: "abandoned", paymentAbandonedAt: new Date().toISOString() },
        { type: "payment_abandoned", label: "Payment abandoned — appointment canceled" },
      ) as object,
    },
  });
}

export async function setAppointmentPendingPayment(
  workspaceId: string,
  appointmentId: string,
  payment: PaymentRecord,
) {
  const prisma = getPrisma();
  const expiresAt = paymentHoldExpiresAt();
  await prisma.voiceAppointment.update({
    where: { id: appointmentId },
    data: {
      status: "pending_payment",
      metadata: {
        paymentStatus: "pending",
        paymentProvider: payment.provider.toLowerCase(),
        paymentMode: payment.paymentMode,
        totalPriceCents: payment.totalPriceCents,
        amountDueCents: payment.amountDueCents,
        balanceDueCents: payment.balanceDueCents,
        merchantPaymentId: payment.id,
        paymentHoldExpiresAt: expiresAt.toISOString(),
      } as object,
    },
  });

  try {
    const { emitWorkflowTrigger } = await import("@/lib/appointment-workflows/triggers");
    await emitWorkflowTrigger({
      workspaceId,
      appointmentId,
      trigger: "payment_required",
    });
  } catch {
    // optional
  }
}
