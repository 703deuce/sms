import "server-only";

import { getPrisma } from "@/lib/db";
import { generateSecureToken } from "./crypto";

export async function listGiftCertificateProducts(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.giftCertificateProduct.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function upsertGiftCertificateProduct(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    fixedAmountCents?: number;
    allowCustomAmount?: boolean;
    minAmountCents?: number;
    maxAmountCents?: number;
    denominations?: number[];
    eligibleTypeIds?: string[];
    active?: boolean;
  },
) {
  const prisma = getPrisma();
  const slug =
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const data = {
    name: input.name.trim(),
    slug,
    description: input.description,
    fixedAmountCents: input.fixedAmountCents,
    allowCustomAmount: input.allowCustomAmount ?? false,
    minAmountCents: input.minAmountCents,
    maxAmountCents: input.maxAmountCents,
    denominations: input.denominations || [],
    eligibleTypeIds: input.eligibleTypeIds || [],
    active: input.active ?? true,
  };
  if (input.id) {
    return prisma.giftCertificateProduct.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.giftCertificateProduct.create({ data: { workspaceId, ...data } });
}

export async function issueGiftCertificate(
  workspaceId: string,
  input: {
    productId?: string;
    amountCents: number;
    purchaserContactId?: string;
    recipientEmail?: string;
    recipientName?: string;
    giftMessage?: string;
    deliverAt?: string;
    expiresAt?: string;
  },
) {
  const prisma = getPrisma();
  const code = generateSecureToken(12).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return prisma.giftCertificateBalance.create({
    data: {
      workspaceId,
      productId: input.productId,
      code,
      purchaserContactId: input.purchaserContactId,
      recipientEmail: input.recipientEmail,
      recipientName: input.recipientName,
      giftMessage: input.giftMessage,
      deliverAt: input.deliverAt ? new Date(input.deliverAt) : null,
      balanceCents: input.amountCents,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      status: "active",
    },
  });
}

export async function redeemGiftCertificate(
  workspaceId: string,
  code: string,
  amountCents: number,
  appointmentId?: string,
) {
  const prisma = getPrisma();
  const balance = await prisma.giftCertificateBalance.findFirst({
    where: { workspaceId, code, status: "active" },
  });
  if (!balance) throw new Error("Gift certificate not found");
  if (balance.balanceCents < amountCents) throw new Error("Insufficient gift balance");

  const next = balance.balanceCents - amountCents;
  await prisma.giftCertificateBalance.update({
    where: { id: balance.id },
    data: { balanceCents: next, status: next <= 0 ? "depleted" : "active" },
  });
  await prisma.giftCertificateLedgerEntry.create({
    data: {
      balanceId: balance.id,
      kind: "redeem",
      amountCents: -amountCents,
      appointmentId,
    },
  });
  return { balanceId: balance.id, remainingCents: next };
}
