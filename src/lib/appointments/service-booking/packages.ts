import "server-only";

import { getPrisma } from "@/lib/db";
import { packageBalanceSummary } from "./package-lifecycle";
import type { PackageCreditRule } from "./types";

export type PackageProductRow = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  currency: string;
  creditRules: unknown;
  expirationDays: number | null;
  categoryId: string | null;
  active: boolean;
  directPurchase: boolean;
  standingSlotPolicy: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type PackageCatalogStats = {
  activePackages: number;
  customerPackages: number;
  availableCredits: number;
  redeemedThisMonth: number;
  packageRevenueCents: number;
};

export type PackageBalanceRow = {
  id: string;
  workspaceId: string;
  productId: string;
  contactId: string;
  remainingCredits: unknown;
  expiresAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  contactName: string;
  contactEmail: string | null;
  totalRemaining: number;
};

export type PackageActivityRow = {
  id: string;
  balanceId: string;
  kind: string;
  delta: unknown;
  appointmentId: string | null;
  note: string | null;
  createdAt: Date;
  contactId: string;
  contactName: string;
  balanceAfter: number | null;
};

export async function listPackageProducts(workspaceId: string): Promise<PackageProductRow[]> {
  const prisma = getPrisma();
  return prisma.packageProduct.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
  });
}

export async function getPackageProduct(
  workspaceId: string,
  productId: string,
): Promise<PackageProductRow | null> {
  const prisma = getPrisma();
  return prisma.packageProduct.findFirst({
    where: { id: productId, workspaceId },
  });
}

export async function getPackageCatalogStats(workspaceId: string): Promise<PackageCatalogStats> {
  const prisma = getPrisma();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [activePackages, balances, redeemedThisMonth, purchaseEntries] = await Promise.all([
    prisma.packageProduct.count({ where: { workspaceId, active: true } }),
    prisma.packageBalance.findMany({
      where: { workspaceId, status: { in: ["active", "exhausted"] } },
      select: { remainingCredits: true, status: true },
    }),
    prisma.packageLedgerEntry.count({
      where: {
        kind: "redeem",
        createdAt: { gte: monthStart },
        balance: { workspaceId },
      },
    }),
    prisma.packageLedgerEntry.findMany({
      where: { kind: "purchase", balance: { workspaceId } },
      include: { balance: { include: { product: true } } },
    }),
  ]);

  let availableCredits = 0;
  for (const balance of balances) {
    if (balance.status !== "active") continue;
    availableCredits += packageBalanceSummary(
      (balance.remainingCredits || {}) as Record<string, number>,
    ).totalRemaining;
  }

  const packageRevenueCents = purchaseEntries.reduce(
    (sum: number, entry: { balance?: { product?: { priceCents?: number } } }) =>
      sum + Number(entry.balance?.product?.priceCents ?? 0),
    0,
  );

  return {
    activePackages,
    customerPackages: balances.length,
    availableCredits,
    redeemedThisMonth,
    packageRevenueCents,
  };
}

function contactDisplayName(contact: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email?: string | null;
}): string {
  const parts = [contact.firstName, contact.lastName].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (contact.name?.trim()) return contact.name.trim();
  if (contact.email?.trim()) return contact.email.trim();
  return "Customer";
}

export async function listPackageBalancesForProduct(
  workspaceId: string,
  productId: string,
): Promise<PackageBalanceRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.packageBalance.findMany({
    where: { workspaceId, productId },
    orderBy: { createdAt: "desc" },
  });
  type BalanceRow = (typeof rows)[number];
  const contactIds = [...new Set(rows.map((row: BalanceRow) => row.contactId))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      })
    : [];
  type ContactRow = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
  };
  const contactById = new Map(contacts.map((c: ContactRow) => [c.id, c]));

  return rows.map((row: BalanceRow) => {
    const contact = contactById.get(row.contactId) as ContactRow | undefined;
    const remaining = (row.remainingCredits || {}) as Record<string, number>;
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      productId: row.productId,
      contactId: row.contactId,
      remainingCredits: row.remainingCredits,
      expiresAt: row.expiresAt,
      status: row.status,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      contactName: contact ? contactDisplayName(contact) : "Customer",
      contactEmail: contact?.email ?? null,
      totalRemaining: packageBalanceSummary(remaining).totalRemaining,
    };
  });
}

export async function listPackageActivityForProduct(
  workspaceId: string,
  productId: string,
): Promise<PackageActivityRow[]> {
  const prisma = getPrisma();
  const entries = await prisma.packageLedgerEntry.findMany({
    where: { balance: { workspaceId, productId } },
    include: {
      balance: {
        select: { contactId: true, remainingCredits: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  type LedgerRow = (typeof entries)[number];
  const contactIds = [...new Set(entries.map((e: LedgerRow) => e.balance.contactId))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      })
    : [];
  type ContactRow = {
    id: string;
    firstName: string | null;
    lastName: string | null;
    name: string | null;
    email: string | null;
  };
  const contactById = new Map(contacts.map((c: ContactRow) => [c.id, c]));

  return entries.map((entry: LedgerRow) => {
    const contact = contactById.get(entry.balance.contactId);
    const remaining = (entry.balance.remainingCredits || {}) as Record<string, number>;
    return {
      id: entry.id,
      balanceId: entry.balanceId,
      kind: entry.kind,
      delta: entry.delta,
      appointmentId: entry.appointmentId,
      note: entry.note,
      createdAt: entry.createdAt,
      contactId: entry.balance.contactId,
      contactName: contact ? contactDisplayName(contact) : "Customer",
      balanceAfter: packageBalanceSummary(remaining).totalRemaining,
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
  let n = 2;
  while (
    await prisma.packageProduct.findFirst({
      where: { workspaceId, slug },
    })
  ) {
    slug = `${baseSlug}-${n}`;
    n += 1;
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

export async function deletePackageProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const owners = await prisma.packageBalance.count({
    where: { workspaceId, productId },
  });
  if (owners > 0) {
    throw new Error(
      `${owners} customer package${owners === 1 ? "" : "s"} exist for this package. Deactivate it instead.`,
    );
  }
  await prisma.packageProduct.delete({ where: { id: productId, workspaceId } });
  return { deleted: true };
}

export async function countPackageOwners(
  workspaceId: string,
  productIds: string[],
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const prisma = getPrisma();
  const counts: Array<{ productId: string; _count: { productId: number } }> =
    await prisma.packageBalance.groupBy({
      by: ["productId"],
      where: { workspaceId, productId: { in: productIds }, status: { in: ["active", "exhausted"] } },
      _count: { productId: true },
    });
  return new Map(counts.map((c) => [c.productId, c._count.productId]));
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
    directPurchase?: boolean;
    metadata?: Record<string, unknown>;
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
  if (input.id) {
    const existing = await prisma.packageProduct.findFirst({
      where: { id: input.id, workspaceId },
    });
    if (!existing) throw new Error("Package not found");
    const data = {
      name: input.name?.trim() || existing.name,
      slug: input.slug || slug || existing.slug,
      description: input.description !== undefined ? input.description : existing.description,
      priceCents: input.priceCents ?? existing.priceCents,
      creditRules: input.creditRules ?? existing.creditRules,
      expirationDays:
        input.expirationDays !== undefined ? input.expirationDays : existing.expirationDays,
      categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
      active: input.active ?? existing.active,
      directPurchase: input.directPurchase ?? existing.directPurchase,
      metadata: input.metadata ?? existing.metadata,
      standingSlotPolicy: input.standingSlotPolicy ?? existing.standingSlotPolicy,
    };
    return prisma.packageProduct.update({ where: { id: input.id, workspaceId }, data });
  }

  const data = {
    name: input.name.trim(),
    slug,
    description: input.description,
    priceCents: input.priceCents ?? 0,
    creditRules: input.creditRules || [],
    expirationDays: input.expirationDays,
    categoryId: input.categoryId,
    active: input.active ?? true,
    directPurchase: input.directPurchase ?? true,
    metadata: input.metadata,
    standingSlotPolicy: input.standingSlotPolicy,
  };
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
  // Eligibility-only rules carry quantity 0; only positive quantities mint credits.
  for (const rule of rules) {
    if (!rule.quantity || rule.quantity <= 0) continue;
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
