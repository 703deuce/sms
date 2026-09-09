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
