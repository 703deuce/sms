import "server-only";

import { getPrisma } from "@/lib/db";
import type { FaxTier } from "./types";
import { FAX_TIER_PAGES } from "./types";
import { includedPagesForFaxTier } from "@/lib/products/platform-billing-catalog";

export async function syncFaxAccountFromSubscription(input: {
  workspaceId: string;
  tier: FaxTier;
  active: boolean;
  stripeSubscriptionId?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
}) {
  const prisma = getPrisma();
  const pagesIncluded = includedPagesForFaxTier(input.tier) || FAX_TIER_PAGES[input.tier];

  await prisma.faxAccount.upsert({
    where: { workspaceId: input.workspaceId },
    create: {
      workspaceId: input.workspaceId,
      tier: input.tier,
      status: input.active ? "active" : "inactive",
      pagesIncluded,
      stripeSubscriptionId: input.stripeSubscriptionId || null,
      usagePeriodStart: input.periodStart || null,
      usagePeriodEnd: input.periodEnd || null,
    },
    update: {
      tier: input.tier,
      status: input.active ? "active" : "inactive",
      pagesIncluded,
      stripeSubscriptionId: input.stripeSubscriptionId || undefined,
      usagePeriodStart: input.periodStart || undefined,
      usagePeriodEnd: input.periodEnd || undefined,
    },
  });
}

export async function resetFaxUsagePeriod(workspaceId: string, periodStart: Date, periodEnd: Date) {
  const prisma = getPrisma();
  await prisma.faxAccount.updateMany({
    where: { workspaceId },
    data: {
      pagesUsedThisPeriod: 0,
      overagePages: 0,
      usagePeriodStart: periodStart,
      usagePeriodEnd: periodEnd,
    },
  });
}

export async function deactivateFaxAccount(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.faxAccount.updateMany({
    where: { workspaceId },
    data: { status: "past_due" },
  });
}
