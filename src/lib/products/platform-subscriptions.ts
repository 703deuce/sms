import "server-only";

import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import {
  dualProductCouponId,
  featureForProductFamily,
  getPlatformBillingCatalog,
  includedMinutesForSmartRoutingTier,
  includedMinutesForCallForwardingTier,
  includedMinutesForAiTranscriptionTier,
  type MctbTier,
  type PlatformProductFamily,
  type SmartRoutingTier,
  type CallForwardingTier,
  type AiTranscriptionTier,
} from "@/lib/products/platform-billing-catalog";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import { getOrCreateStripeCustomer } from "@/lib/settings/billing";
import { subscriptionBillingPeriod } from "@/lib/payments/stripe-type-helpers";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type PlatformSubscriptionRow = {
  id: string;
  workspaceId: string;
  productFamily: string;
  tier: string;
  stripeSubscriptionId: string;
  status: string;
};

type PlatformSubscriptionFamily =
  | PlatformProductFamily
  | "appointment_reminders"
  | "mctb_ai_recovery"
  | "mctb_own_sender";

function parseFamilyFromMetadata(
  metadata: Record<string, string | undefined>,
): PlatformSubscriptionFamily | null {
  const productKey = metadata.platformProductKey || "";
  if (productKey === "mctb_ai_recovery" || metadata.platformProductFamily === "mctb_ai_recovery") {
    return "mctb_ai_recovery";
  }
  if (productKey === "mctb_own_sender" || metadata.platformProductFamily === "mctb_own_sender") {
    return "mctb_own_sender";
  }
  const family = metadata.platformProductFamily || productKey.split("_")[0];
  if (family === "mctb" || family === "smart_routing" || family === "call_forwarding") return family;
  if (family === "ai_transcription") return "ai_transcription";
  if (family === "fax") return "fax";
  if (family === "appointment_reminders") return "appointment_reminders";
  if (productKey.startsWith("mctb_") && productKey !== "mctb_ai_recovery" && productKey !== "mctb_own_sender") {
    return "mctb";
  }
  if (productKey === "mctb") return "mctb";
  if (metadata.platformProductKey?.startsWith("smart_routing")) return "smart_routing";
  if (metadata.platformProductKey?.startsWith("call_forwarding")) return "call_forwarding";
  if (metadata.platformProductKey?.startsWith("ai_transcription")) return "ai_transcription";
  if (metadata.platformProductKey?.startsWith("fax")) return "fax";
  if (
    metadata.platformProductFamily === "appointment_reminders" ||
    metadata.platformProductKey?.startsWith("appointment_reminders")
  ) {
    return "appointment_reminders";
  }
  return null;
}

function parseTierFromMetadata(
  metadata: Record<string, string | undefined>,
  family: PlatformSubscriptionFamily,
): string | null {
  if (family === "mctb_ai_recovery" || family === "mctb_own_sender") {
    return metadata.platformTier || "standard";
  }
  if (metadata.platformTier) return metadata.platformTier;
  const key = metadata.platformProductKey || "";
  const prefix = `${family}_`;
  if (key.startsWith(prefix)) return key.slice(prefix.length);
  return null;
}

export function isPlatformProductSubscription(
  subscription: Stripe.Subscription,
): boolean {
  const md = (subscription.metadata || {}) as Record<string, string | undefined>;
  if (!md.workspaceId) return false;
  if (parseFamilyFromMetadata(md)) return true;
  const key = md.platformProductKey || "";
  return (
    key === "mctb_ai_recovery" ||
    key === "mctb_own_sender" ||
    (key.startsWith("mctb_") && key !== "mctb_ai_recovery" && key !== "mctb_own_sender") ||
    key === "mctb" ||
    key.startsWith("smart_routing") ||
    key.startsWith("call_forwarding") ||
    key.startsWith("ai_transcription") ||
    key.startsWith("fax") ||
    key === "mctb" ||
    key === "smart_routing" ||
    key === "call_forwarding" ||
    key === "fax" ||
    key === "bundle_mctb_sr" ||
    key.startsWith("appointment_reminders") ||
    key === "appointment_reminders"
  );
}

export async function upsertPlatformProductSubscriptionFromStripe(
  subscription: Stripe.Subscription,
): Promise<PlatformSubscriptionRow | null> {
  const metadata = (subscription.metadata || {}) as Record<string, string | undefined>;
  const workspaceId = metadata.workspaceId;
  const family = parseFamilyFromMetadata(metadata);
  if (!workspaceId || !family) return null;

  const tier = parseTierFromMetadata(metadata, family);
  if (!tier) return null;

  const item = subscription.items.data[0];
  const stripePriceId = item?.price?.id || "";
  const prisma = getPrisma();
  const status = subscription.status;
  const active = ACTIVE_STATUSES.has(status);

  const includedMinutes =
    family === "smart_routing"
      ? includedMinutesForSmartRoutingTier(tier as SmartRoutingTier)
      : family === "call_forwarding"
        ? includedMinutesForCallForwardingTier(tier as CallForwardingTier)
        : family === "ai_transcription"
          ? includedMinutesForAiTranscriptionTier(tier as AiTranscriptionTier)
          : null;

  const { periodStart, periodEnd } = subscriptionBillingPeriod(subscription);

  const row = await prisma.platformProductSubscription.upsert({
    where: {
      workspaceId_productFamily: { workspaceId, productFamily: family },
    },
    create: {
      workspaceId,
      productFamily: family,
      tier,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || null,
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      includedMinutes,
      usagePeriodStart: periodStart,
      usagePeriodEnd: periodEnd,
      metadataJson: metadata as object,
    },
    update: {
      tier,
      stripeSubscriptionId: subscription.id,
      stripePriceId,
      status,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      includedMinutes,
      metadataJson: metadata as object,
    },
  });

  if (family === "appointment_reminders") {
    if (active) {
      const { clearArFreePlanMarker } = await import(
        "@/lib/appointment-reminders/commercial/ar-workspace-plan"
      );
      await clearArFreePlanMarker(workspaceId);
    }
    await prisma.platformProductSubscription.update({
      where: { id: row.id },
      data: {
        usagePeriodStart: periodStart,
        usagePeriodEnd: periodEnd,
      },
    });
    await syncDualProductDiscountForWorkspace(workspaceId);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      productFamily: row.productFamily,
      tier: row.tier,
      stripeSubscriptionId: row.stripeSubscriptionId,
      status: row.status,
    };
  }

  if (family === "mctb_ai_recovery" || family === "mctb_own_sender") {
    const { applyMctbCommercialAddonProductKey, MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS } = await import(
      "@/lib/mctb/commercial-entitlement-grants"
    );
    const productKey =
      family === "mctb_ai_recovery"
        ? MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.aiRecovery
        : MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.ownSender;
    await applyMctbCommercialAddonProductKey(workspaceId, productKey, active);
  } else {
    await grantWorkspaceProductFeature(
      workspaceId,
      featureForProductFamily(family as PlatformProductFamily),
      active ? "active" : "inactive",
    );
  }

  if (family === "fax") {
    const { syncFaxAccountFromSubscription } = await import("@/lib/fax/fax-billing");
    await syncFaxAccountFromSubscription({
      workspaceId,
      tier: tier as import("@/lib/fax/types").FaxTier,
      active,
      stripeSubscriptionId: subscription.id,
      periodStart: periodStart,
      periodEnd: periodEnd,
    });
  }

  await syncDualProductDiscountForWorkspace(workspaceId);

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    productFamily: row.productFamily,
    tier: row.tier,
    stripeSubscriptionId: row.stripeSubscriptionId,
    status: row.status,
  };
}

export async function listActivePlatformSubscriptions(
  workspaceId: string,
): Promise<PlatformSubscriptionRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.platformProductSubscription.findMany({
    where: { workspaceId },
  });
  return rows
    .filter((r: { status: string }) => ACTIVE_STATUSES.has(r.status))
    .map((r: {
      id: string;
      workspaceId: string;
      productFamily: string;
      tier: string;
      stripeSubscriptionId: string;
      status: string;
    }) => ({
      id: r.id,
      workspaceId: r.workspaceId,
      productFamily: r.productFamily,
      tier: r.tier,
      stripeSubscriptionId: r.stripeSubscriptionId,
      status: r.status,
    }));
}

export async function workspaceHasDualProductDiscountEligibility(
  workspaceId: string,
): Promise<boolean> {
  const active = await listActivePlatformSubscriptions(workspaceId);
  const families = new Set(active.map((r) => r.productFamily));
  return families.has("mctb") && families.has("smart_routing");
}

/** Apply or remove 20% coupon on all platform subscriptions for a workspace. */
export async function syncDualProductDiscountForWorkspace(workspaceId: string): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;

  const prisma = getPrisma();
  const subs = await prisma.platformProductSubscription.findMany({
    where: { workspaceId, status: { in: Array.from(ACTIVE_STATUSES) } },
  });
  const eligible =
    subs.some((s: { productFamily: string }) => s.productFamily === "mctb") &&
    subs.some((s: { productFamily: string }) => s.productFamily === "smart_routing");
  const couponId = dualProductCouponId();

  for (const sub of subs) {
    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const hasCoupon = (stripeSub.discounts || []).some((d) => {
        if (typeof d === "string") return d === couponId;
        const row = d as { coupon?: string | { id?: string } };
        const couponRef =
          typeof row.coupon === "string" ? row.coupon : row.coupon?.id;
        return couponRef === couponId;
      });
      if (eligible && !hasCoupon) {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          discounts: [{ coupon: couponId }],
        });
      } else if (!eligible && hasCoupon) {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          discounts: [],
        });
      }
    } catch (err) {
      console.warn("[platform-subscription] discount sync failed", sub.stripeSubscriptionId, err);
    }
  }
}

export async function createPlatformCheckoutSession(input: {
  workspaceId: string;
  userId: string;
  userEmail: string;
  productKey: string;
  origin: string;
  successPath?: string;
  nextProductKey?: string;
}): Promise<{ url: string | null; sessionId: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const { parseCheckoutSelection } = await import("@/lib/products/platform-billing-catalog");
  const selection = parseCheckoutSelection(input.productKey);

  if (selection.family === "verify_pack") {
    const { isVerifyLaunchEnabled } = await import("@/lib/products/v1-product-status");
    if (!isVerifyLaunchEnabled()) throw new Error("VERIFY_DORMANT");
    const { createVerifyCreditsCheckoutSession } = await import("@/lib/verify/verify-billing");
    return createVerifyCreditsCheckoutSession({
      workspaceId: input.workspaceId,
      userId: input.userId,
      productKey: input.productKey,
      origin: input.origin,
      returnPath: input.successPath,
    });
  }

  const customerId = await getOrCreateStripeCustomer(input.workspaceId);

  if (input.productKey === "mctb_own_sender") {
    const catalog = getPlatformBillingCatalog();
    const addon = catalog.addons.mctb_own_sender;
    if (!addon) throw new Error("Own Local Number add-on is not configured");
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: addon.stripePriceId, quantity: 1 },
    ];
    if (addon.stripeOneTimePriceId) {
      lineItems.push({ price: addon.stripeOneTimePriceId, quantity: 1 });
    }
    const successParams = new URLSearchParams({
      platform_checkout: "success",
      product: input.productKey,
    });
    if (input.nextProductKey) successParams.set("next_product", input.nextProductKey);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      success_url: `${input.origin}${input.successPath || "/settings/billing"}?${successParams}`,
      cancel_url: `${input.origin}/settings/billing?platform_checkout=cancel`,
      metadata: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        platformProductKey: input.productKey,
        platformProductFamily: "mctb_own_sender",
        platformTier: "default",
      },
      subscription_data: {
        metadata: {
          workspaceId: input.workspaceId,
          platformProductKey: input.productKey,
          platformProductFamily: "mctb_own_sender",
          platformTier: "default",
        },
      },
    });
    return { url: session.url, sessionId: session.id };
  }

  const willHaveBoth =
    (selection.family === "mctb" &&
      (await prismaHasActiveFamily(input.workspaceId, "smart_routing"))) ||
    (selection.family === "smart_routing" &&
      (await prismaHasActiveFamily(input.workspaceId, "mctb")));

  const applyDiscountOnCheckout = willHaveBoth;

  const successParams = new URLSearchParams({ platform_checkout: "success", product: input.productKey });
  if (input.nextProductKey) successParams.set("next_product", input.nextProductKey);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: selection.stripePriceId, quantity: 1 }],
    success_url: `${input.origin}${input.successPath || "/settings/billing"}?${successParams}`,
    cancel_url: `${input.origin}/settings/billing?platform_checkout=cancel`,
    metadata: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      platformProductKey: input.productKey,
      platformProductFamily: selection.family,
      platformTier: String(selection.tier || ""),
    },
    subscription_data: {
      metadata: {
        workspaceId: input.workspaceId,
        platformProductKey: input.productKey,
        platformProductFamily: selection.family,
        platformTier: String(selection.tier || ""),
      },
    },
    discounts: applyDiscountOnCheckout ? [{ coupon: dualProductCouponId() }] : undefined,
  });

  return { url: session.url, sessionId: session.id };
}

async function prismaHasActiveFamily(
  workspaceId: string,
  family: PlatformProductFamily,
): Promise<boolean> {
  const prisma = getPrisma();
  const row = await prisma.platformProductSubscription.findFirst({
    where: { workspaceId, productFamily: family, status: { in: Array.from(ACTIVE_STATUSES) } },
  });
  return Boolean(row);
}

export type PlatformSubscriptionManageAction =
  | "cancel_at_period_end"
  | "cancel_now"
  | "resume";

export async function managePlatformProductSubscription(input: {
  workspaceId: string;
  productFamily: PlatformSubscriptionFamily;
  action: PlatformSubscriptionManageAction;
}): Promise<{
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const prisma = getPrisma();
  const sub = await prisma.platformProductSubscription.findUnique({
    where: {
      workspaceId_productFamily: {
        workspaceId: input.workspaceId,
        productFamily: input.productFamily,
      },
    },
  });
  if (!sub?.stripeSubscriptionId) {
    throw new Error("No subscription found for this product");
  }
  if (!ACTIVE_STATUSES.has(sub.status) && input.action !== "resume") {
    throw new Error("Subscription is not active");
  }

  if (input.action === "cancel_now") {
    const canceled = await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
    await upsertPlatformProductSubscriptionFromStripe(canceled);
    return {
      status: canceled.status,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  const cancelAtPeriodEnd = input.action === "cancel_at_period_end";
  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: cancelAtPeriodEnd,
  });
  const { periodEnd } = subscriptionBillingPeriod(updated);
  await prisma.platformProductSubscription.update({
    where: { id: sub.id },
    data: {
      cancelAtPeriodEnd: updated.cancel_at_period_end,
      currentPeriodEnd: periodEnd,
      status: updated.status,
    },
  });
  return {
    status: updated.status,
    cancelAtPeriodEnd: updated.cancel_at_period_end,
    currentPeriodEnd: periodEnd,
  };
}

export async function changePlatformSubscriptionTier(input: {
  workspaceId: string;
  productFamily: PlatformProductFamily;
  newTier: MctbTier | SmartRoutingTier | AiTranscriptionTier;
}): Promise<void> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const prisma = getPrisma();
  const sub = await prisma.platformProductSubscription.findUnique({
    where: {
      workspaceId_productFamily: {
        workspaceId: input.workspaceId,
        productFamily: input.productFamily,
      },
    },
  });
  if (!sub) throw new Error("No active subscription for product family");

  const catalog = getPlatformBillingCatalog();
  const newPriceId =
    input.productFamily === "mctb"
      ? catalog.mctb.tiers[input.newTier as MctbTier].stripePriceId
      : input.productFamily === "smart_routing"
        ? catalog.smart_routing.tiers[input.newTier as SmartRoutingTier].stripePriceId
        : catalog.ai_transcription.tiers[input.newTier as AiTranscriptionTier].stripePriceId;

  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const itemId = stripeSub.items.data[0]?.id;
  if (!itemId) throw new Error("Subscription has no items");

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: "create_prorations",
    metadata: {
      ...((stripeSub.metadata || {}) as Record<string, string>),
      platformTier: input.newTier,
      platformProductKey: `${input.productFamily}_${input.newTier}`,
    },
  });
}

export async function getPlatformBillingSnapshot(workspaceId: string) {
  const prisma = getPrisma();
  const subs = await prisma.platformProductSubscription.findMany({
    where: { workspaceId },
    orderBy: { productFamily: "asc" },
  });
  const dualDiscount = await workspaceHasDualProductDiscountEligibility(workspaceId);
  return { subscriptions: subs, dualDiscountActive: dualDiscount };
}
