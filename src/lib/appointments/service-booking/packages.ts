import "server-only";

import { getPrisma } from "@/lib/db";
import type { PackageCreditRule } from "./types";

export async function listPackageProducts(workspaceId: string) {
  const prisma = getPrisma();
  return prisma.packageProduct.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function upsertPackageProduct(
  workspaceId: string,
  input: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    priceCents?: number;
    creditRules?: PackageCreditRule[];
    expirationDays?: number;
    categoryId?: string;
    active?: boolean;
    standingSlotPolicy?: Record<string, unknown>;
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
    priceCents: input.priceCents ?? 0,
    creditRules: input.creditRules || [],
    expirationDays: input.expirationDays,
    categoryId: input.categoryId,
    active: input.active ?? true,
    standingSlotPolicy: input.standingSlotPolicy,
  };
  if (input.id) {
    return prisma.packageProduct.update({ where: { id: input.id, workspaceId }, data });
  }
  return prisma.packageProduct.create({ data: { workspaceId, ...data } });
}

export async function purchasePackageForContact(
  workspaceId: string,
  productId: string,
  contactId: string,
) {
  const prisma = getPrisma();
  const product = await prisma.packageProduct.findFirst({
    where: { id: productId, workspaceId, active: true },
  });
  if (!product) throw new Error("Package not found");

  const rules = (product.creditRules || []) as PackageCreditRule[];
  const remainingCredits: Record<string, number> = {};
  for (const rule of rules) {
    const key = rule.bookingTypeId || rule.serviceName || "default";
    remainingCredits[key] = (remainingCredits[key] || 0) + rule.quantity;
  }
  if (Object.keys(remainingCredits).length === 0) {
    remainingCredits.default = 1;
  }

  const expiresAt =
    product.expirationDays != null
      ? new Date(Date.now() + product.expirationDays * 86_400_000)
      : null;

  const balance = await prisma.packageBalance.create({
    data: {
      workspaceId,
      productId,
      contactId,
      remainingCredits,
      expiresAt,
      status: "active",
    },
  });

  await prisma.packageLedgerEntry.create({
    data: {
      balanceId: balance.id,
      kind: "purchase",
      delta: remainingCredits,
      note: `Purchased package ${product.name}`,
    },
  });

  return balance;
}

export function packagePurchaseUrl(baseUrl: string, workspaceSlug: string, packageSlug: string) {
  return `${baseUrl.replace(/\/$/, "")}/book/${workspaceSlug}/packages/${packageSlug}`;
}
