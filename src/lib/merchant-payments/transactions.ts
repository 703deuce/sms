import "server-only";

import { getPrisma, type DbRow } from "@/lib/db";

export type MerchantPaymentTransactionView = {
  id: string;
  appointmentId: string;
  appointmentTitle: string;
  customerName: string;
  customerPhone: string;
  contactId: string | null;
  provider: string;
  status: string;
  paymentMode: string;
  currency: string;
  totalPriceCents: number;
  amountPaidCents: number;
  refundAmountCents: number;
  paidAt: string | null;
  createdAt: string;
  source: string;
  paymentMethodLabel: string | null;
  failureReason: string | null;
  providerPaymentId: string | null;
};

function paymentMethodLabelFromMetadata(
  provider: string,
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  const meta = metadata || {};
  const brand = String(meta.cardBrand || meta.brand || "").trim();
  const last4 = String(meta.cardLast4 || meta.last4 || "").trim();
  if (brand && last4) return `${brand} •••• ${last4}`;
  if (last4) return `Card •••• ${last4}`;
  if (provider.toLowerCase() === "square") return "Square";
  if (provider.toLowerCase() === "stripe") return "Stripe";
  return null;
}

function failureReasonFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  const meta = metadata || {};
  const code = String(meta.failureCode || meta.declineCode || meta.errorCode || "").trim();
  const message = String(meta.failureMessage || meta.errorMessage || "").trim();
  if (message) return message;
  if (code === "card_declined") return "Card declined";
  if (code) return code.replace(/_/g, " ");
  return null;
}

export async function listMerchantPaymentTransactions(
  workspaceId: string,
  options?: {
    limit?: number;
    status?: string;
    provider?: string;
    query?: string;
  },
): Promise<MerchantPaymentTransactionView[]> {
  const prisma = getPrisma();
  const limit = options?.limit ?? 100;

  const rows = await prisma.appointmentMerchantPayment.findMany({
    where: {
      workspaceId,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.provider ? { provider: options.provider } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const appointmentIds = [...new Set(rows.map((r: DbRow) => r.appointmentId).filter(Boolean))];
  const appointments = appointmentIds.length
    ? await prisma.voiceAppointment.findMany({
        where: { workspaceId, id: { in: appointmentIds } },
        select: { id: true, serviceName: true, contactId: true },
      })
    : [];
  type AptRow = { id: string; serviceName: string | null; contactId: string | null };
  type ContactRow = { id: string; firstName: string | null; lastName: string | null; phone: string };
  const appointmentById = new Map<string, AptRow>(
    appointments.map((a: DbRow) => [a.id as string, a as AptRow]),
  );

  const contactIds = [
    ...new Set(appointments.map((a: DbRow) => a.contactId).filter(Boolean) as string[]),
  ];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const contactById = new Map<string, ContactRow>(
    contacts.map((c: DbRow) => [c.id as string, c as ContactRow]),
  );

  const mapped = rows.map((row: DbRow) => {
    const apt = appointmentById.get(row.appointmentId as string);
    const contact = apt?.contactId ? contactById.get(apt.contactId) : null;
    const customerName =
      [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
      contact?.phone ||
      "Customer";
    const metadata = (row.metadata || {}) as Record<string, unknown>;

    return {
      id: row.id,
      appointmentId: row.appointmentId,
      appointmentTitle: apt?.serviceName || "Appointment",
      customerName,
      customerPhone: contact?.phone || "",
      contactId: apt?.contactId ?? null,
      provider: row.provider,
      status: row.status,
      paymentMode: row.paymentMode,
      currency: row.currency,
      totalPriceCents: row.totalPriceCents,
      amountPaidCents: row.amountPaidCents,
      refundAmountCents: row.refundAmountCents,
      paidAt: row.paidAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      source: "Appointment",
      paymentMethodLabel: paymentMethodLabelFromMetadata(row.provider, metadata),
      failureReason: row.status === "failed" ? failureReasonFromMetadata(metadata) : null,
      providerPaymentId: row.providerPaymentId ?? null,
    };
  });

  const q = options?.query?.trim().toLowerCase();
  if (!q) return mapped;

  return mapped.filter(
    (row: MerchantPaymentTransactionView) =>
      row.customerName.toLowerCase().includes(q) ||
      row.appointmentTitle.toLowerCase().includes(q) ||
      row.id.toLowerCase().includes(q) ||
      (row.providerPaymentId || "").toLowerCase().includes(q),
  );
}
