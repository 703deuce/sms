import "server-only";

import { getPrisma } from "@/lib/db";
import { buildInvoicePdfBuffer } from "./invoice-pdf";
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

export async function getInvoiceByPayToken(payToken: string) {
  const prisma = getPrisma();
  const invoice = await prisma.bookingInvoice.findFirst({
    where: { payTokenHash: hashToken(payToken) },
    include: { lineItems: true },
  });
  if (!invoice) return null;

  const [workspace, contact] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: invoice.workspaceId },
      select: { name: true, slug: true },
    }),
    prisma.contact.findFirst({
      where: { id: invoice.contactId, workspaceId: invoice.workspaceId },
      select: { firstName: true, lastName: true, email: true },
    }),
  ]);

  return { invoice, workspace, contact };
}

export async function getInvoiceById(workspaceId: string, invoiceId: string) {
  const prisma = getPrisma();
  const invoice = await prisma.bookingInvoice.findFirst({
    where: { id: invoiceId, workspaceId },
    include: { lineItems: true },
  });
  if (!invoice) return null;

  const [workspace, contact] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, slug: true },
    }),
    prisma.contact.findFirst({
      where: { id: invoice.contactId, workspaceId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    }),
  ]);

  return { invoice, workspace, contact };
}

export async function rotateInvoicePayToken(workspaceId: string, invoiceId: string) {
  const prisma = getPrisma();
  const invoice = await prisma.bookingInvoice.findFirst({
    where: { id: invoiceId, workspaceId },
    select: { id: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const rawToken = generateSecureToken();
  await prisma.bookingInvoice.update({
    where: { id: invoiceId },
    data: { payTokenHash: hashToken(rawToken) },
  });
  return rawToken;
}

export async function sendInvoiceEmail(
  workspaceId: string,
  invoiceId: string,
  baseUrl: string,
) {
  const row = await getInvoiceById(workspaceId, invoiceId);
  if (!row) throw new Error("Invoice not found");

  const { invoice, workspace, contact } = row;
  const email = contact?.email?.trim();
  if (!email) throw new Error("Customer email is required to send an invoice");

  const payToken = await rotateInvoicePayToken(workspaceId, invoiceId);
  const payUrl = invoicePublicPayUrl(baseUrl, payToken);
  const customerName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || "Customer";
  const businessName = workspace?.name || "Your business";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: invoice.currency.toUpperCase(),
  }).format(invoice.balanceDueCents / 100);
  const dueLine = invoice.dueAt
    ? `Due: ${invoice.dueAt.toLocaleDateString(undefined, { dateStyle: "medium" })}`
    : "";

  const subject = `Invoice from ${businessName}`;
  const textBody = [
    `Hi ${customerName},`,
    "",
    `${businessName} sent you an invoice for ${amount}.`,
    dueLine,
    "",
    `View and pay your invoice: ${payUrl}`,
    "",
    "Thank you.",
  ]
    .filter(Boolean)
    .join("\n");

  const { sendTransactionalEmail } = await import("@/lib/email/brevo");
  const result = await sendTransactionalEmail({
    to: email,
    subject,
    htmlContent: textBody.replace(/\n/g, "<br/>"),
    textContent: textBody,
    workspaceId,
  });

  if (result.status === "failed") {
    throw new Error(result.error || "Email delivery failed");
  }

  const priorMeta = (invoice.metadata || {}) as Record<string, unknown>;
  const deliveries = Array.isArray(priorMeta.emailDeliveries) ? priorMeta.emailDeliveries : [];
  const deliveryRecord = {
    at: new Date().toISOString(),
    to: email,
    provider: result.provider,
    providerMessageId: result.id,
    status: result.status,
  };

  const prisma = getPrisma();
  const updated = await prisma.bookingInvoice.update({
    where: { id: invoiceId },
    data: {
      status: invoice.status === "draft" ? "open" : invoice.status,
      metadata: {
        ...priorMeta,
        emailDeliveries: [...deliveries, deliveryRecord],
        lastEmailSentAt: deliveryRecord.at,
      } as object,
    },
    include: { lineItems: true },
  });

  return { invoice: updated, payUrl, delivery: deliveryRecord };
}

export async function buildInvoicePdf(workspaceId: string, invoiceId: string) {
  const row = await getInvoiceById(workspaceId, invoiceId);
  if (!row) throw new Error("Invoice not found");

  const { invoice, workspace, contact } = row;
  const customerName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || "Customer";

  return buildInvoicePdfBuffer({
    businessName: workspace?.name || "Your business",
    invoiceNumber: invoice.id.slice(-8).toUpperCase(),
    customerName,
    customerEmail: contact?.email,
    status: invoice.status,
    createdAt: invoice.createdAt.toISOString(),
    dueAt: invoice.dueAt?.toISOString() ?? null,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    discountCents: invoice.discountCents,
    totalCents: invoice.totalCents,
    balanceDueCents: invoice.balanceDueCents,
    currency: invoice.currency,
    note: invoice.note,
    lineItems: invoice.lineItems.map((line: {
      description: string;
      quantity: number;
      unitPriceCents: number;
    }) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.quantity * line.unitPriceCents,
    })),
  });
}

export function serializePublicInvoice(
  row: Awaited<ReturnType<typeof getInvoiceByPayToken>>,
) {
  if (!row) return null;
  const { invoice, workspace, contact } = row;
  const customerName = [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") || "Customer";
  return {
    id: invoice.id,
    status: invoice.status,
    currency: invoice.currency,
    subtotalCents: invoice.subtotalCents,
    taxCents: invoice.taxCents,
    discountCents: invoice.discountCents,
    totalCents: invoice.totalCents,
    depositPaidCents: invoice.depositPaidCents,
    balanceDueCents: invoice.balanceDueCents,
    dueAt: invoice.dueAt?.toISOString() ?? null,
    note: invoice.note,
    createdAt: invoice.createdAt.toISOString(),
    businessName: workspace?.name || "Your business",
    customerName,
    customerEmail: contact?.email || null,
    lineItems: invoice.lineItems.map((line: {
      description: string;
      quantity: number;
      unitPriceCents: number;
    }) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.quantity * line.unitPriceCents,
    })),
    canPayOnline: invoice.balanceDueCents > 0 && invoice.status !== "paid",
  };
}
