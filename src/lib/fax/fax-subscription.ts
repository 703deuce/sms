import "server-only";

import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import {
  FAX_OVERAGE_CENTS_PER_PAGE,
  FAX_TIER_INCLUDED_PAGES,
  FAX_TIER_PRICES_CENTS,
} from "@/lib/products/platform-billing-catalog-definitions";
import { getFaxUsageSnapshot } from "./fax-usage";
import { getPrimaryFaxNumber } from "./fax-number-provisioning";
import type { FaxTier } from "./types";

export async function getFaxBillingSnapshot(workspaceId: string) {
  const prisma = getPrisma();
  const [usage, number, sub, account] = await Promise.all([
    getFaxUsageSnapshot(workspaceId),
    getPrimaryFaxNumber(workspaceId),
    prisma.platformProductSubscription.findUnique({
      where: { workspaceId_productFamily: { workspaceId, productFamily: "fax" } },
    }),
    prisma.faxAccount.findUnique({ where: { workspaceId } }),
  ]);

  const tier = (sub?.tier || account?.tier || "starter") as FaxTier;
  const monthlyPriceCents = FAX_TIER_PRICES_CENTS[tier] ?? FAX_TIER_PRICES_CENTS.starter;
  const includedPages = FAX_TIER_INCLUDED_PAGES[tier] ?? usage.pagesIncluded;

  return {
    tier,
    monthlyPriceCents,
    includedPages,
    overageRateCents: FAX_OVERAGE_CENTS_PER_PAGE,
    includedFaxNumbers: 1,
    pagesUsed: usage.pagesUsed,
    pagesRemaining: usage.pagesRemaining,
    faxNumber: number?.e164 || null,
    subscriptionStatus: sub?.status || account?.status || "inactive",
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd || account?.usagePeriodEnd || null,
    stripeSubscriptionId: sub?.stripeSubscriptionId || account?.stripeSubscriptionId || null,
  };
}

export async function cancelFaxSubscriptionAtPeriodEnd(workspaceId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const prisma = getPrisma();
  const sub = await prisma.platformProductSubscription.findUnique({
    where: { workspaceId_productFamily: { workspaceId, productFamily: "fax" } },
  });
  if (!sub?.stripeSubscriptionId) throw new Error("No active fax subscription found");

  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.platformProductSubscription.update({
    where: { id: sub.id },
    data: { cancelAtPeriodEnd: true, status: updated.status },
  });

  return {
    cancelAtPeriodEnd: true,
    currentPeriodEnd: sub.currentPeriodEnd,
    faxNumberActiveUntil: sub.currentPeriodEnd,
    message:
      "Your fax plan will remain active until the end of your billing period. Your fax number stays active until then. Historical records remain available. You may request to port your number out before release.",
  };
}
