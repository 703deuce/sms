import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
import { transitionNumberService } from "@/lib/numbers/state-service";
import type { MarketplaceServiceKey } from "@/lib/payments/stripe-marketplace-metadata";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export const FORWARDING_PLAN_INCLUDED_MINUTES = 200;

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): string {
  if (status === "canceled" || status === "incomplete_expired") return "canceled";
  if (status === "past_due") return "past_due";
  if (status === "unpaid") return "unpaid";
  if (status === "trialing") return "trialing";
  if (status === "active") return "active";
  return status;
}

async function activateServiceOnNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
  productKey: MarketplaceServiceKey;
}) {
  if (input.productKey === "vault") {
    await transitionNumberService(input.workspaceId, input.phoneNumberId, "park");
    return;
  }
  if (input.productKey === "voicemail") {
    await transitionNumberService(input.workspaceId, input.phoneNumberId, "enable_voicemail");
  }
}

async function deactivateServiceOnNumber(input: {
  workspaceId: string;
  phoneNumberId: string;
  productKey: MarketplaceServiceKey;
}) {
  if (input.productKey === "forwarding_200") {
    await transitionNumberService(input.workspaceId, input.phoneNumberId, "clear_forwarding");
    return;
  }
  if (input.productKey === "voicemail") {
    await transitionNumberService(input.workspaceId, input.phoneNumberId, "disable_voicemail");
  }
}

export async function upsertNumberServiceSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  metadata: Record<string, string>,
) {
  const prisma = getPrisma();
  const workspaceId = metadata.workspaceId;
  const userId = metadata.userId;
  const phoneNumberId = metadata.phoneNumberId;
  const productKey = metadata.service as MarketplaceServiceKey;
  if (!workspaceId || !userId || !phoneNumberId || !productKey) {
    throw new Error("marketplace subscription missing workspaceId, userId, phoneNumberId, or service metadata");
  }

  const product = await prisma.marketplaceBillingProduct.findUnique({ where: { productKey } });
  if (!product) throw new Error(`Unknown marketplace service product: ${productKey}`);

  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const mappedStatus = mapStripeSubscriptionStatus(subscription.status);
  const periodStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000)
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  const row = await prisma.numberServiceSubscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      workspaceId,
      userId,
      phoneNumberId,
      productKey,
      productId: product.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      status: mappedStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      includedMinutesPerPeriod: product.includedUsageMinutes,
      minutesUsedThisPeriod: 0,
      usagePeriodStart: periodStart,
      usagePeriodEnd: periodEnd,
    },
    update: {
      stripeCustomerId: customerId,
      stripePriceId: priceId,
      status: mappedStatus,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      includedMinutesPerPeriod: product.includedUsageMinutes,
      ...(periodStart ? { usagePeriodStart: periodStart } : {}),
      ...(periodEnd ? { usagePeriodEnd: periodEnd } : {}),
    },
  });

  if (ACTIVE_STATUSES.has(mappedStatus)) {
    await activateServiceOnNumber({ workspaceId, phoneNumberId, productKey });
  } else {
    await deactivateServiceOnNumber({ workspaceId, phoneNumberId, productKey });
  }

  return row;
}

export async function resetForwardingUsageForBillingPeriod(subscriptionId: string) {
  const prisma = getPrisma();
  await prisma.numberServiceSubscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId, productKey: "forwarding_200" },
    data: { minutesUsedThisPeriod: 0 },
  });
}

export async function getActiveNumberServiceSubscription(
  phoneNumberId: string,
  productKey: MarketplaceServiceKey,
) {
  const prisma = getPrisma();
  return prisma.numberServiceSubscription.findFirst({
    where: {
      phoneNumberId,
      productKey,
      status: { in: ["active", "trialing", "past_due"] },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function assertActiveNumberServiceSubscription(input: {
  workspaceId: string;
  phoneNumberId: string;
  productKey: MarketplaceServiceKey;
}) {
  const row = await getActiveNumberServiceSubscription(input.phoneNumberId, input.productKey);
  if (!row || row.workspaceId !== input.workspaceId) {
    return {
      ok: false as const,
      error: `An active ${input.productKey.replace("_", " ")} subscription is required.`,
    };
  }
  return { ok: true as const, subscription: row };
}

export async function getForwardingMinuteLimitForNumber(phoneNumberId: string): Promise<number> {
  const sub = await getActiveNumberServiceSubscription(phoneNumberId, "forwarding_200");
  if (!sub) return 0;
  return sub.includedMinutesPerPeriod ?? FORWARDING_PLAN_INCLUDED_MINUTES;
}
