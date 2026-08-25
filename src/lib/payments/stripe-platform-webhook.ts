import "server-only";

import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import {
  SMART_ROUTING_OVERAGE_CENTS_PER_MINUTE,
} from "@/lib/products/platform-billing-catalog-definitions";
import {
  isPlatformProductSubscription,
  syncDualProductDiscountForWorkspace,
  upsertPlatformProductSubscriptionFromStripe,
} from "@/lib/products/platform-subscriptions";
import {
  addonFeature,
  parseCheckoutSelection,
} from "@/lib/products/platform-billing-catalog";
import { grantWorkspaceProductFeature } from "@/lib/products/feature-entitlements";
import type { TransovoProductFeature } from "@/lib/products/feature-entitlements";
import { handleVerifyCreditsCheckoutCompleted } from "@/lib/verify/verify-billing";

export async function handlePlatformCheckoutCompleted(session: Stripe.Checkout.Session) {
  const verifyResult = await handleVerifyCreditsCheckoutCompleted(session);
  if (verifyResult.handled) {
    return { handled: true, subsystem: "verify_credits" as const, credits: verifyResult.credits };
  }

  const stripe = getStripe();
  const workspaceId = session.metadata?.workspaceId;
  const productKey = session.metadata?.platformProductKey;
  if (!workspaceId || !productKey) return { handled: false };

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (subscriptionId && stripe) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (isPlatformProductSubscription(subscription)) {
      await upsertPlatformProductSubscriptionFromStripe(subscription);
      return { handled: true, subsystem: "platform_product" as const, productKey };
    }
  }

  try {
    const sel = parseCheckoutSelection(productKey);
    if (sel.family === "addon") {
      await grantWorkspaceProductFeature(workspaceId, sel.feature, "active");
      return { handled: true, subsystem: "platform_addon" as const, productKey };
    }
  } catch {
    // legacy keys
  }

  const legacyFeatures: TransovoProductFeature[] = [];
  if (productKey === "bundle_mctb_sr") legacyFeatures.push("mctb", "smart_routing");
  else if (productKey === "mctb") legacyFeatures.push("mctb");
  else if (productKey === "smart_routing") legacyFeatures.push("smart_routing");
  else {
    const feat = addonFeature(productKey);
    if (feat) legacyFeatures.push(feat);
  }
  for (const feature of legacyFeatures) {
    await grantWorkspaceProductFeature(workspaceId, feature, "active");
  }
  await syncDualProductDiscountForWorkspace(workspaceId);
  return { handled: legacyFeatures.length > 0, subsystem: "platform_product" as const, productKey };
}

export async function handlePlatformSubscriptionEvent(
  subscription: Stripe.Subscription,
  eventType?: string,
) {
  if (!isPlatformProductSubscription(subscription)) {
    return { handled: false };
  }

  const workspaceId = subscription.metadata?.workspaceId;
  const isDeleted =
    eventType === "customer.subscription.deleted" ||
    subscription.status === "canceled" ||
    subscription.status === "unpaid";

  if (isDeleted) {
    const prisma = getPrisma();
    const family =
      subscription.metadata?.platformProductFamily ||
      subscription.metadata?.platformProductKey?.split("_")[0];
    if (workspaceId && family) {
      await prisma.platformProductSubscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: subscription.status, cancelAtPeriodEnd: subscription.cancel_at_period_end },
      });
      const feature =
        family === "mctb" || family === "smart_routing" || family === "fax"
          ? (family as "mctb" | "smart_routing" | "fax")
          : null;
      if (feature) {
        await grantWorkspaceProductFeature(workspaceId, feature, "inactive");
      }
      if (family === "fax" && workspaceId) {
        const { deactivateFaxAccount } = await import("@/lib/fax/fax-billing");
        await deactivateFaxAccount(workspaceId);
      }
      await syncDualProductDiscountForWorkspace(workspaceId);
    }
    return { handled: true, deactivated: true };
  }

  await upsertPlatformProductSubscriptionFromStripe(subscription);
  return { handled: true, deactivated: false };
}

export async function handlePlatformInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const prisma = getPrisma();
  const subs = await prisma.platformProductSubscription.findMany({
    where: { stripeCustomerId: customerId },
  });
  for (const sub of subs) {
    if (sub.productFamily === "smart_routing") {
      await prisma.platformProductSubscription.update({
        where: { id: sub.id },
        data: {
          minutesUsedThisPeriod: 0,
          overageMinutesBilled: 0,
          usagePeriodStart: sub.currentPeriodStart,
          usagePeriodEnd: sub.currentPeriodEnd,
        },
      });
    }
    if (sub.productFamily === "ai_transcription") {
      await prisma.platformProductSubscription.update({
        where: { id: sub.id },
        data: {
          transcriptionMinutesUsedThisPeriod: 0,
          usagePeriodStart: sub.currentPeriodStart,
          usagePeriodEnd: sub.currentPeriodEnd,
        },
      });
    }
    if (sub.productFamily === "fax" && sub.currentPeriodStart && sub.currentPeriodEnd) {
      const { resetFaxUsagePeriod } = await import("@/lib/fax/fax-billing");
      await resetFaxUsagePeriod(sub.workspaceId, sub.currentPeriodStart, sub.currentPeriodEnd);
    }
  }
}

export async function handlePlatformInvoiceUpcoming(invoice: Stripe.Invoice): Promise<void> {
  const stripe = getStripe();
  if (!stripe) return;
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const prisma = getPrisma();
  const sub = await prisma.platformProductSubscription.findFirst({
    where: {
      stripeCustomerId: customerId,
      productFamily: "smart_routing",
      status: { in: ["active", "trialing", "past_due"] },
    },
  });
  if (!sub || !sub.includedMinutes) return;

  const overage = Math.max(0, sub.minutesUsedThisPeriod - sub.includedMinutes);
  if (overage <= 0) return;
  if (sub.overageMinutesBilled >= overage) return;

  const billableMinutes = overage - sub.overageMinutesBilled;
  const amountCents = billableMinutes * SMART_ROUTING_OVERAGE_CENTS_PER_MINUTE;
  if (amountCents <= 0) return;

  await stripe.invoiceItems.create({
    customer: customerId,
    amount: amountCents,
    currency: "usd",
    description: `Smart Routing overage — ${billableMinutes} conversation minutes @ $0.02/min`,
    metadata: {
      transovo_product: "smart_routing",
      overage_minutes: String(billableMinutes),
      subscription_id: sub.stripeSubscriptionId,
    },
  });

  await prisma.platformProductSubscription.update({
    where: { id: sub.id },
    data: { overageMinutesBilled: overage },
  });
}
