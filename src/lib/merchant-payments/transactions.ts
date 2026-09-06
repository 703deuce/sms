import "server-only";

import { getPrisma } from "@/lib/db";

export type MerchantPaymentTransactionView = {
  id: string;
  appointmentId: string;
  provider: string;
  status: string;
  paymentMode: string;
  currency: string;
  totalPriceCents: number;
  amountPaidCents: number;
  refundAmountCents: number;
  paidAt: string | null;
  createdAt: string;
};

export async function listMerchantPaymentTransactions(
  workspaceId: string,
  limit = 100,
): Promise<MerchantPaymentTransactionView[]> {
  const prisma = getPrisma();
  const rows = await prisma.appointmentMerchantPayment.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    appointmentId: row.appointmentId,
    provider: row.provider,
    status: row.status,
    paymentMode: row.paymentMode,
    currency: row.currency,
    totalPriceCents: row.totalPriceCents,
    amountPaidCents: row.amountPaidCents,
    refundAmountCents: row.refundAmountCents,
    paidAt: row.paidAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
