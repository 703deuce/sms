import "server-only";

import { getPrisma } from "@/lib/db";
import { FAX_TIER_PAGES, type FaxTier } from "./types";

export async function getOrCreateFaxAccount(workspaceId: string) {
  const prisma = getPrisma();
  const existing = await prisma.faxAccount.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  return prisma.faxAccount.create({
    data: {
      workspaceId,
      tier: "starter",
      pagesIncluded: FAX_TIER_PAGES.starter,
      status: "inactive",
    },
  });
}

export async function getFaxUsageSnapshot(workspaceId: string) {
  const account = await getOrCreateFaxAccount(workspaceId);
  const remaining = Math.max(0, account.pagesIncluded + account.overagePages - account.pagesUsedThisPeriod);
  return {
    tier: account.tier as FaxTier,
    pagesIncluded: account.pagesIncluded,
    pagesUsed: account.pagesUsedThisPeriod,
    overagePages: account.overagePages,
    pagesRemaining: remaining,
    usagePeriodStart: account.usagePeriodStart,
    usagePeriodEnd: account.usagePeriodEnd,
    status: account.status,
  };
}

export async function assertFaxPageAllowance(workspaceId: string, pages: number): Promise<void> {
  const account = await getOrCreateFaxAccount(workspaceId);
  if (account.status !== "active") throw new Error("FAX_NOT_ACTIVE");
  const remaining = account.pagesIncluded + account.overagePages - account.pagesUsedThisPeriod;
  if (pages > remaining) {
    throw new Error("INSUFFICIENT_FAX_PAGES");
  }
}

export async function recordFaxPageUsage(input: {
  workspaceId: string;
  pages: number;
  idempotencyKey: string;
}) {
  const prisma = getPrisma();
  const account = await getOrCreateFaxAccount(input.workspaceId);
  const existing = await prisma.faxWebhookEvent.findUnique({
    where: { telnyxEventId: input.idempotencyKey },
  });
  if (existing?.processedAt) return { duplicate: true, pagesRecorded: 0 };

  const pages = Math.max(1, input.pages);
  const newUsed = account.pagesUsedThisPeriod + pages;
  let overagePages = account.overagePages;
  if (newUsed > account.pagesIncluded) {
    overagePages = newUsed - account.pagesIncluded;
  }

  await prisma.faxAccount.update({
    where: { id: account.id },
    data: {
      pagesUsedThisPeriod: newUsed,
      overagePages,
    },
  });

  return { duplicate: false, pagesRecorded: pages };
}

export function pagesForTier(tier: FaxTier): number {
  return FAX_TIER_PAGES[tier];
}
