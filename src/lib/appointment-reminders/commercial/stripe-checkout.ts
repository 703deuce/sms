import "server-only";

import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { getOrCreateStripeCustomer } from "@/lib/settings/billing";
import { getAppBaseUrl } from "@/lib/messaging/telnyx/config";
import {
  arPlanDefinition,
  type ArPlanKey,
  isArPlanKey,
} from "@/lib/appointment-reminders/commercial/ar-plan-catalog";
import {
  arCheckoutMetadata,
  resolveArStripePriceId,
} from "@/lib/appointment-reminders/commercial/ar-stripe-catalog";
import { AR_PLATFORM_PRODUCT_FAMILY } from "@/lib/appointment-reminders/ar-sms-usage-constants";
import { getPrisma } from "@/lib/db";

const ACTIVE = new Set(["active", "trialing", "past_due"]);

export async function createAppointmentRemindersCheckoutSession(input: {
  workspaceId: string;
  plan: ArPlanKey;
  successUrl?: string;
  cancelUrl?: string;
}): Promise<{ url: string; sessionId: string }> {
  if (input.plan === "free") throw new Error("Use free activation instead of Stripe checkout");
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");

  const existing = await getPrisma().platformProductSubscription.findUnique({
    where: {
      workspaceId_productFamily: {
        workspaceId: input.workspaceId,
        productFamily: AR_PLATFORM_PRODUCT_FAMILY,
      },
    },
  });
  if (existing && ACTIVE.has(existing.status) && existing.tier !== "free") {
    throw new Error(
      "This workspace already has an active Appointment Reminders subscription. Use billing settings to change plans.",
    );
  }

  const priceId = resolveArStripePriceId(input.plan);
  const customerId = await getOrCreateStripeCustomer(input.workspaceId);
  const base = getAppBaseUrl();
  const metadata = arCheckoutMetadata({ workspaceId: input.workspaceId, plan: input.plan });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url:
      input.successUrl ||
      `${base}/appointment-reminders/setup/connect?checkout=success&plan=${input.plan}`,
    cancel_url:
      input.cancelUrl || `${base}/appointment-reminders/pricing?checkout=canceled`,
    metadata,
    subscription_data: { metadata },
    allow_promotion_codes: false,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

export async function changeAppointmentRemindersSubscriptionPlan(input: {
  workspaceId: string;
  plan: ArPlanKey;
}): Promise<{ immediate: boolean; scheduledDowngrade?: boolean }> {
  if (input.plan === "free") {
    throw new Error("Use subscription management to cancel; Free is applied after the paid period ends.");
  }
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");

  const sub = await getPrisma().platformProductSubscription.findUnique({
    where: {
      workspaceId_productFamily: {
        workspaceId: input.workspaceId,
        productFamily: AR_PLATFORM_PRODUCT_FAMILY,
      },
    },
    select: {
      id: true,
      tier: true,
      status: true,
      stripeSubscriptionId: true,
      metadataJson: true,
    },
  });
  if (!sub?.stripeSubscriptionId || !ACTIVE.has(sub.status)) {
    throw new Error("No active Appointment Reminders subscription to change");
  }

  const currentTier = isArPlanKey(sub.tier) ? sub.tier : input.plan;
  const currentCents = arPlanDefinition(currentTier).monthlyPriceCents;
  const targetCents = arPlanDefinition(input.plan).monthlyPriceCents;
  const priceId = resolveArStripePriceId(input.plan);
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const itemId = stripeSub.items.data[0]?.id;
  const currentPriceId = stripeSub.items.data[0]?.price?.id;
  if (!itemId || !currentPriceId) throw new Error("Subscription has no billable items");

  const metadata = arCheckoutMetadata({ workspaceId: input.workspaceId, plan: input.plan });

  if (targetCents < currentCents) {
    const periodEnd = stripeSub.items.data[0]?.current_period_end;
    if (!periodEnd) throw new Error("Could not read subscription period end for scheduled downgrade");
    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: sub.stripeSubscriptionId,
    });
    await stripe.subscriptionSchedules.update(schedule.id, {
      end_behavior: "release",
      phases: [
        {
          items: [{ price: currentPriceId, quantity: 1 }],
          start_date: schedule.phases[0]?.start_date ?? stripeSub.items.data[0]?.current_period_start,
          end_date: periodEnd,
        },
        {
          items: [{ price: priceId, quantity: 1 }],
          start_date: periodEnd,
        },
      ],
      metadata: {
        workspaceId: input.workspaceId,
        platformProductFamily: AR_PLATFORM_PRODUCT_FAMILY,
        scheduledArPlanKey: input.plan,
      },
    });
    const priorMeta =
      sub.metadataJson && typeof sub.metadataJson === "object" && !Array.isArray(sub.metadataJson)
        ? (sub.metadataJson as Record<string, unknown>)
        : {};
    await getPrisma().platformProductSubscription.update({
      where: { id: sub.id },
      data: {
        metadataJson: {
          ...priorMeta,
          scheduledArDowngradePlan: input.plan,
          scheduledArDowngradeAt: new Date(periodEnd * 1000).toISOString(),
        },
      },
    });
    return { immediate: false, scheduledDowngrade: true };
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: itemId, price: priceId }],
    proration_behavior: "create_prorations",
    metadata: { ...((stripeSub.metadata || {}) as Record<string, string>), ...metadata },
  });
  return { immediate: true };
}

export async function createAppointmentRemindersBillingPortalSession(
  workspaceId: string,
  returnUrl?: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe billing is not configured");
  const customerId = await getOrCreateStripeCustomer(workspaceId);
  const base = getAppBaseUrl();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl || `${base}/appointment-reminders/settings?tab=billing`,
  });
  return session.url;
}
