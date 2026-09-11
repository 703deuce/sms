import "server-only";

import { getPrisma } from "@/lib/db";
import { createAppointmentCheckoutSession } from "@/lib/appointments/payment-checkout";
import type { PaymentRequirement } from "@/lib/appointments/types";
import { getPaymentByAppointment } from "@/lib/merchant-payments/payment-record-store";

export async function getManageAppointmentPaymentSummary(workspaceId: string, appointmentId: string) {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");

  const meta = (row.metadata || {}) as Record<string, unknown>;
  const paymentStatus = String(meta.paymentStatus || "");
  const balanceDueCents = Number(meta.balanceDueCents || 0);
  const totalPriceCents = Number(meta.totalPriceCents || meta.paymentAmountCents || 0);
  const record = await getPaymentByAppointment(workspaceId, appointmentId);

  return {
    paymentStatus,
    balanceDueCents,
    totalPriceCents,
    amountPaidCents: Number(meta.paymentAmountCents || record?.amountPaidCents || 0),
    paymentRequired: balanceDueCents > 0 || paymentStatus === "pending",
    merchantPaymentId: record?.id || null,
  };
}

/** POS / admin: collect outstanding balance with server-side revalidation (cents). */
export async function collectAppointmentBalancePayment(
  workspaceId: string,
  appointmentId: string,
  input: {
    amountCents: number;
    method: "cash" | "external" | "card";
    idempotencyKey?: string;
    note?: string;
  },
) {
  const prisma = getPrisma();
  const summary = await getManageAppointmentPaymentSummary(workspaceId, appointmentId);
  if (summary.balanceDueCents <= 0) {
    throw new Error("No balance due on this appointment");
  }
  if (input.amountCents <= 0 || input.amountCents > summary.balanceDueCents) {
    throw new Error("Invalid collection amount for current balance");
  }

  if (input.idempotencyKey) {
    const dup = await prisma.appointmentMerchantPayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (dup) return { paymentId: dup.id, appointmentId, amountCents: input.amountCents, duplicate: true };
  }

  const row = await prisma.voiceAppointment.findFirst({
    where: { id: appointmentId, workspaceId },
  });
  if (!row) throw new Error("Appointment not found");

  const meta = (row.metadata || {}) as Record<string, unknown>;
  const totalPriceCents = summary.totalPriceCents || Number(meta.totalPriceCents || 0);
  const prevPaid = Number(meta.paymentAmountCents || meta.depositPaidCents || 0);
  const newPaid = prevPaid + input.amountCents;
  const newBalance = Math.max(0, totalPriceCents - newPaid);

  const { createPaymentRecord, updatePaymentRecord } = await import(
    "@/lib/merchant-payments/payment-record-store"
  );
  const { syncAppointmentPaymentMetadata } = await import("@/lib/merchant-payments/appointment-lifecycle");

  const record = await createPaymentRecord({
    workspaceId,
    appointmentId,
    provider: "STRIPE",
    paymentMode: newBalance > 0 ? "deposit" : "full",
    currency: "usd",
    totalPriceCents: totalPriceCents || newPaid,
    amountDueCents: input.amountCents,
    balanceDueCents: newBalance,
    idempotencyKey: input.idempotencyKey,
  });

  const paid = await updatePaymentRecord(record.id, {
    status: input.method === "card" ? "pending" : "succeeded",
    amountPaidCents: input.amountCents,
    balanceDueCents: newBalance,
    paidAt: input.method === "card" ? undefined : new Date(),
    metadata: { posMethod: input.method, note: input.note },
  });

  if (input.method !== "card") {
    await syncAppointmentPaymentMetadata(workspaceId, appointmentId, {
      ...paid,
      amountPaidCents: newPaid,
      balanceDueCents: newBalance,
      status: newBalance > 0 ? "partially_paid" : "succeeded",
    } as import("@/lib/merchant-payments/payment-record-store").PaymentRecord);

    const { appendTimeline } = await import("@/lib/appointments/settings");
    await prisma.voiceAppointment.update({
      where: { id: appointmentId },
      data: {
        metadata: appendTimeline(
          {
            ...meta,
            paymentAmountCents: newPaid,
            depositPaidCents: Number(meta.depositPaidCents || 0) || undefined,
            balanceDueCents: newBalance,
            paymentStatus: newBalance > 0 ? "partially_paid" : "paid",
            paidAt: newBalance === 0 ? new Date().toISOString() : meta.paidAt,
          },
          {
            type: "pos_balance_collected",
            label: "Balance collected at POS",
            detail: `$${(input.amountCents / 100).toFixed(2)} via ${input.method}`,
          },
        ) as object,
      },
    });
  }

  return { paymentId: paid.id, appointmentId, amountCents: input.amountCents, balanceDueCents: newBalance };
}

export async function createManageAppointmentPaymentCheckout(
  workspaceId: string,
  appointmentId: string,
  customerEmail?: string,
) {
  const summary = await getManageAppointmentPaymentSummary(workspaceId, appointmentId);
  if (!summary.paymentRequired || summary.balanceDueCents <= 0) {
    return { required: false, checkoutUrl: null };
  }

  const payment: PaymentRequirement = {
    mode: "full",
    priceCents: summary.balanceDueCents,
    currency: "usd",
    provider: "stripe",
  };

  const result = await createAppointmentCheckoutSession({
    workspaceId,
    appointmentId,
    payment,
    customerEmail,
    description: "Outstanding appointment balance",
  });

  return {
    required: true,
    checkoutUrl: result.url,
    configured: result.configured,
    error: result.error,
  };
}

export async function transferAppointmentPaymentOnReschedule(
  workspaceId: string,
  fromAppointmentId: string,
  toAppointmentId: string,
) {
  if (fromAppointmentId === toAppointmentId) return { transferred: false };

  const prisma = getPrisma();
  const from = await prisma.voiceAppointment.findFirst({
    where: { id: fromAppointmentId, workspaceId },
  });
  const to = await prisma.voiceAppointment.findFirst({
    where: { id: toAppointmentId, workspaceId },
  });
  if (!from || !to) return { transferred: false };

  const fromMeta = (from.metadata || {}) as Record<string, unknown>;
  const paymentKeys = [
    "paymentStatus",
    "paymentProvider",
    "paymentMode",
    "totalPriceCents",
    "paymentAmountCents",
    "depositPaidCents",
    "balanceDueCents",
    "merchantPaymentId",
    "providerPaymentId",
    "providerSessionId",
    "paidAt",
    "entitlementPayment",
  ];

  const paymentPatch: Record<string, unknown> = {};
  for (const key of paymentKeys) {
    if (fromMeta[key] !== undefined) paymentPatch[key] = fromMeta[key];
  }
  if (Object.keys(paymentPatch).length === 0) return { transferred: false };

  const toMeta = (to.metadata || {}) as Record<string, unknown>;
  await prisma.voiceAppointment.update({
    where: { id: toAppointmentId },
    data: {
      metadata: {
        ...toMeta,
        ...paymentPatch,
        paymentTransferredFrom: fromAppointmentId,
      } as object,
    },
  });

  await prisma.voiceAppointment.update({
    where: { id: fromAppointmentId },
    data: {
      metadata: {
        ...fromMeta,
        paymentStatus: "transferred",
        paymentTransferredTo: toAppointmentId,
      } as object,
    },
  });

  const record = await getPaymentByAppointment(workspaceId, fromAppointmentId);
  if (record) {
    await prisma.appointmentMerchantPayment.updateMany({
      where: { id: record.id, workspaceId },
      data: { appointmentId: toAppointmentId },
    });
  }

  return { transferred: true };
}
