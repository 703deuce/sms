import "server-only";

import { getPrisma } from "@/lib/db";
import type { PackageCreditRule, PackageLifecyclePolicy } from "./types";
import { packageBalanceSummary } from "./package-lifecycle";

export async function listPackageProducts(workspaceId: string) {
  const prisma = getPrisma();
  const products = await prisma.packageProduct.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    include: {
      balances: {
        where: { status: { in: ["active", "exhausted"] } },
        select: { id: true },
      },
    },
  });
  return products.map((product: (typeof products)[number]) => {
    const { balances, ...rest } = product;
    const creditRules = (rest.creditRules || []) as PackageCreditRule[];
    const includedCredits = creditRules.reduce((sum, rule) => sum + rule.quantity, 0);
    return {
      ...rest,
      customerCount: balances.length,
      includedCredits,
    };
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
    metadata?: Record<string, unknown>;
    directPurchase?: boolean;
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
    metadata: input.metadata,
    ...(input.directPurchase !== undefined ? { directPurchase: input.directPurchase } : {}),
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

export function getPackageLifecyclePolicy(
  metadata: Record<string, unknown> | null | undefined,
): PackageLifecyclePolicy {
  const policy = (metadata as { lifecyclePolicy?: PackageLifecyclePolicy })?.lifecyclePolicy;
  return policy || {};
}

export async function listPackageBalancesForProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const balances = await prisma.packageBalance.findMany({
    where: { workspaceId, productId },
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { name: true } },
    },
  });
  type ContactLite = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
  };
  const contactIds = [...new Set(balances.map((b: (typeof balances)[number]) => b.contactId))];
  const contacts: ContactLite[] = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true, email: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c) => [c.id, c]));
  return balances.map((balance: (typeof balances)[number]) => {
    const remaining = (balance.remainingCredits || {}) as Record<string, number>;
    const contact = contactMap.get(balance.contactId);
    const name =
      [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
      contact?.phone ||
      contact?.email ||
      "Customer";
    return {
      ...balance,
      contactName: name,
      creditsRemaining: packageBalanceSummary(remaining).totalRemaining,
    };
  });
}

export async function duplicatePackageProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const source = await prisma.packageProduct.findFirst({
    where: { id: productId, workspaceId },
  });
  if (!source) throw new Error("Package not found");
  const baseSlug = `${source.slug}-copy`;
  let slug = baseSlug;
  let n = 1;
  while (
    await prisma.packageProduct.findFirst({ where: { workspaceId, slug } })
  ) {
    slug = `${baseSlug}-${n++}`;
  }
  return prisma.packageProduct.create({
    data: {
      workspaceId,
      name: `${source.name} (copy)`,
      slug,
      description: source.description,
      priceCents: source.priceCents,
      currency: source.currency,
      creditRules: source.creditRules,
      expirationDays: source.expirationDays,
      categoryId: source.categoryId,
      active: false,
      directPurchase: source.directPurchase,
      standingSlotPolicy: source.standingSlotPolicy,
      metadata: source.metadata,
    },
  });
}
