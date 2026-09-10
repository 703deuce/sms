import "server-only";

import { getPrisma } from "@/lib/db";
import type { PackageCreditRule, PackageLifecyclePolicy } from "./types";

export function readPackageLifecyclePolicy(
  metadata: unknown,
): PackageLifecyclePolicy {
  const meta = (metadata || {}) as { packageLifecycle?: PackageLifecyclePolicy };
  return meta.packageLifecycle || {
    restoreCreditsOnCancel: true,
    restoreCreditsOnLateCancel: false,
    restoreCreditsOnNoShow: false,
  };
}

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
    metadata?: Record<string, unknown>;
    packageLifecycle?: PackageLifecyclePolicy;
  },
) {
  const prisma = getPrisma();
  const slug =
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  let metadata = input.metadata;
  if (input.packageLifecycle) {
    const existing = input.id
      ? (await prisma.packageProduct.findFirst({ where: { id: input.id, workspaceId }, select: { metadata: true } }))
          ?.metadata
      : null;
    metadata = {
      ...((existing || {}) as Record<string, unknown>),
      ...(input.metadata || {}),
      packageLifecycle: input.packageLifecycle,
    };
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
    standingSlotPolicy: input.standingSlotPolicy,
    metadata,
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

export async function listPackageBalancesForProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  const balances = await prisma.packageBalance.findMany({
    where: { workspaceId, productId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  type BalanceRow = (typeof balances)[number];
  type ContactRow = { id: string; firstName: string | null; lastName: string | null; phone: string };
  const contactIds = [...new Set(balances.map((b: BalanceRow) => b.contactId))];
  const contacts: ContactRow[] = contactIds.length
    ? await prisma.contact.findMany({
        where: { workspaceId, id: { in: contactIds } },
        select: { id: true, firstName: true, lastName: true, phone: true },
      })
    : [];
  const contactMap = new Map(contacts.map((c: ContactRow) => [c.id, c]));
  return balances.map((balance: BalanceRow) => ({
    ...balance,
    contact: contactMap.get(balance.contactId) || null,
  }));
}

export async function getPackageProduct(workspaceId: string, productId: string) {
  const prisma = getPrisma();
  return prisma.packageProduct.findFirst({ where: { id: productId, workspaceId } });
}
