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

export async function listIssuedGiftCertificates(workspaceId: string) {
  const prisma = getPrisma();
  const balances = await prisma.giftCertificateBalance.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { product: { select: { name: true } } },
  });
  type ContactLite = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  const purchaserIds = balances
    .map((b: (typeof balances)[number]) => b.purchaserContactId)
    .filter((id: string | null): id is string => Boolean(id));
  const contacts: ContactLite[] = purchaserIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: purchaserIds } },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  return balances.map((balance: (typeof balances)[number]) => {
    const purchaser = balance.purchaserContactId
      ? contactMap.get(balance.purchaserContactId)
      : null;
    const purchaserName = purchaser
      ? [purchaser.firstName, purchaser.lastName].filter(Boolean).join(" ") ||
        purchaser.phone ||
        purchaser.email
      : null;
    return {
      ...balance,
      purchaserName,
      maskedCode: balance.code.length > 4
        ? `•••• ${balance.code.slice(-4)}`
        : balance.code,
    };
  });
}

export async function getGiftCertificateLedgerHistory(balanceId: string) {
  const prisma = getPrisma();
  const balance = await prisma.giftCertificateBalance.findUnique({
    where: { id: balanceId },
    select: { balanceCents: true },
  });
  const entries = await prisma.giftCertificateLedgerEntry.findMany({
    where: { balanceId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  let running = balance?.balanceCents ?? 0;
  return entries.map((entry: (typeof entries)[number]) => {
    const row = { ...entry, balanceAfterCents: running };
    running -= entry.amountCents;
    return row;
  });
}

export async function duplicateGiftCertificateProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const source = await prisma.giftCertificateProduct.findFirst({
    where: { id: productId, workspaceId },
  });
  if (!source) throw new Error("Gift card option not found");
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let n = 1;
  while (await prisma.giftCertificateProduct.findFirst({ where: { workspaceId, slug } })) {
    slug = `${baseSlug}-${n++}`;
  }
  return prisma.giftCertificateProduct.create({
    data: {
      workspaceId,
      name: `${source.name} (copy)`,
      slug,
      description: source.description,
      fixedAmountCents: source.fixedAmountCents,
      allowCustomAmount: source.allowCustomAmount,
      minAmountCents: source.minAmountCents,
      maxAmountCents: source.maxAmountCents,
      denominations: source.denominations,
      eligibleTypeIds: source.eligibleTypeIds,
      active: false,
      metadata: source.metadata,
    },
  });
}
