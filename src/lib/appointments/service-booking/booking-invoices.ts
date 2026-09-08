import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken, hashToken } from "./crypto";

export async function listInvoices(workspaceId: string, contactId?: string) {
  const prisma = getPrisma();
  return prisma.bookingInvoice.findMany({
    where: { workspaceId, ...(contactId ? { contactId } : {}) },
    orderBy: { createdAt: "desc" },
    include: { lineItems: true },
  });
}

export async function createInvoice(
  workspaceId: string,
  input: {
    contactId: string;
    appointmentIds?: string[];
    lineItems: Array<{
      description: string;
      quantity: number;
      unitPriceCents: number;
      appointmentId?: string;
    }>;
    dueAt?: string;
    depositPaidCents?: number;
    taxCents?: number;
    discountCents?: number;
    currency?: string;
    note?: string;
  },
) {
  const prisma = getPrisma();
  const subtotal = input.lineItems.reduce(
    (s, l) => s + l.quantity * l.unitPriceCents,
    0,
  );
  const totalCents =
    subtotal + (input.taxCents ?? 0) - (input.discountCents ?? 0);
  const balanceDueCents = Math.max(0, totalCents - (input.depositPaidCents ?? 0));
  const rawToken = generateSecureToken();

  const invoice = await prisma.bookingInvoice.create({
    data: {
      workspaceId,
      contactId: input.contactId,
      appointmentIds: input.appointmentIds || [],
      status: balanceDueCents <= 0 ? "paid" : "open",
      subtotalCents: subtotal,
      taxCents: input.taxCents ?? 0,
      discountCents: input.discountCents ?? 0,
      totalCents,
      depositPaidCents: input.depositPaidCents ?? 0,
      balanceDueCents,
      currency: input.currency ?? "usd",
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      note: input.note,
      payTokenHash: hashToken(rawToken),
      lineItems: {
        create: input.lineItems.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
          appointmentId: l.appointmentId,
        })),
      },
    },
    include: { lineItems: true },
  });
  return { invoice, payToken: rawToken };
}

export function invoicePublicPayUrl(baseUrl: string, payToken: string) {
  return `${baseUrl.replace(/\/$/, "")}/pay/invoice/${payToken}`;
}
