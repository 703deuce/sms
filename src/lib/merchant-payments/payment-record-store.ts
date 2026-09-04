import "server-only";

import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import type { MerchantPaymentProvider, MerchantPaymentStatus } from "./types";

export type PaymentRecord = {
  id: string;
  workspaceId: string;
  appointmentId: string;
  provider: string;
  status: string;
  paymentMode: string;
  currency: string;
  totalPriceCents: number;
  amountDueCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  providerPaymentId: string | null;
  providerSessionId: string | null;
  idempotencyKey: string | null;
  refundAmountCents: number;
  refundStatus: string | null;
  paidAt: Date | null;
  metadata: unknown;
};

export async function createPaymentRecord(input: {
  workspaceId: string;
  appointmentId: string;
  provider: MerchantPaymentProvider;
  paymentMode: "deposit" | "full";
  currency: string;
  totalPriceCents: number;
  amountDueCents: number;
  balanceDueCents: number;
  idempotencyKey?: string;
  providerSessionId?: string;
}): Promise<PaymentRecord> {
  const prisma = getPrisma();
  if (input.idempotencyKey) {
    const existing = await prisma.appointmentMerchantPayment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing as PaymentRecord;
  }

  const row = await prisma.appointmentMerchantPayment.create({
    data: {
      id: createId(),
      workspaceId: input.workspaceId,
      appointmentId: input.appointmentId,
      provider: input.provider,
      status: "pending",
      paymentMode: input.paymentMode,
      currency: input.currency,
      totalPriceCents: input.totalPriceCents,
      amountDueCents: input.amountDueCents,
      balanceDueCents: input.balanceDueCents,
      idempotencyKey: input.idempotencyKey || null,
      providerSessionId: input.providerSessionId || null,
    },
  });
  return row as PaymentRecord;
}

export async function getPaymentByAppointment(
  workspaceId: string,
  appointmentId: string,
): Promise<PaymentRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.appointmentMerchantPayment.findFirst({
    where: { workspaceId, appointmentId },
    orderBy: { createdAt: "desc" },
  });
  return row as PaymentRecord | null;
}

/** Resolve payment by appointment id when workspace is unknown (e.g. provider webhooks). */
export async function findPaymentByAppointmentId(
  appointmentId: string,
): Promise<PaymentRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.appointmentMerchantPayment.findFirst({
    where: { appointmentId },
    orderBy: { createdAt: "desc" },
  });
  return row as PaymentRecord | null;
}

export async function getPaymentByProviderSession(
  providerSessionId: string,
): Promise<PaymentRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.appointmentMerchantPayment.findFirst({
    where: { providerSessionId },
  });
  return row as PaymentRecord | null;
}

export async function getPaymentByProviderPaymentId(
  providerPaymentId: string,
): Promise<PaymentRecord | null> {
  const prisma = getPrisma();
  const row = await prisma.appointmentMerchantPayment.findFirst({
    where: { providerPaymentId },
  });
  return row as PaymentRecord | null;
}

export async function updatePaymentRecord(
  id: string,
  patch: Partial<{
    status: MerchantPaymentStatus;
    amountPaidCents: number;
    balanceDueCents: number;
    providerPaymentId: string;
    providerSessionId: string;
    refundAmountCents: number;
    refundStatus: string;
    paidAt: Date;
    failedAt: Date;
    canceledAt: Date;
    metadata: Record<string, unknown>;
  }>,
): Promise<PaymentRecord> {
  const prisma = getPrisma();
  const row = await prisma.appointmentMerchantPayment.update({
    where: { id },
    data: patch as object,
  });
  return row as PaymentRecord;
}
