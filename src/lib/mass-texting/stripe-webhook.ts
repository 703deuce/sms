import "server-only";

import type Stripe from "stripe";
import { recordMassTextingBillingEvent } from "@/lib/mass-texting/ops-events";
import {
  applyMonthlyPlanFromCheckout,
  applyPaygLineFromCheckout,
  applyPaygPackPurchase,
} from "@/lib/mass-texting/trial-lifecycle";
import { parseMassTextCheckoutKey } from "@/lib/mass-texting/pricing";
import { getOrCreateMassTextingBillingAccount, updateMassTextingLifecycle } from "@/lib/mass-texting/billing-account";
import { subscriptionBillingPeriod, invoiceSubscriptionId } from "@/lib/payments/stripe-type-helpers";

export function isMassTextingCheckoutMetadata(
  metadata: Record<string, string | undefined>,
): boolean {
  return metadata.product === "mass_texting" && Boolean(metadata.massTextProductKey);
}

export async function handleMassTextingCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  if (!isMassTextingCheckoutMetadata(metadata)) return { handled: false as const };

  const workspaceId = metadata.workspaceId!;
  const productKey = metadata.massTextProductKey!;
  const parsed = parseMassTextCheckoutKey(productKey);
  if (!parsed) return { handled: false as const };

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (parsed.kind === "monthly" && subscriptionId) {
    await applyMonthlyPlanFromCheckout({
      workspaceId,
      tier: parsed.tier,
      stripeSubscriptionId: subscriptionId,
      a2pWaived: metadata.a2pWaived === "true",
    });
  } else if (parsed.kind === "payg_line" && subscriptionId) {
    await applyPaygLineFromCheckout({ workspaceId, stripeSubscriptionId: subscriptionId });
  } else if (parsed.kind === "payg_pack") {
    await applyPaygPackPurchase({
      workspaceId,
      packKey: parsed.pack,
      a2pWaived: metadata.a2pWaived === "true",
    });
  } else if (parsed.kind === "a2p_registration") {
    await updateMassTextingLifecycle(workspaceId, "PRODUCTION_A2P_PENDING", {
      a2pFeeStatus: "PAID",
    });
  }

  return { handled: true as const, productKey };
}

export async function handleMassTextingStripeEvent(
  event: Stripe.Event,
): Promise<{ handled: boolean }> {
  const recorded = await recordMassTextingBillingEvent({
    stripeEventId: event.id,
    eventType: event.type,
    workspaceId:
      ((event.data.object as { metadata?: { workspaceId?: string } })?.metadata?.workspaceId) ??
      null,
    payload: event.data.object,
  });
  if (!recorded) return { handled: true };

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const result = await handleMassTextingCheckoutCompleted(session);
    return { handled: result.handled };
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const md = (sub.metadata || {}) as Record<string, string | undefined>;
    if (md.product === "mass_texting" && md.workspaceId) {
      await updateMassTextingLifecycle(md.workspaceId, "CANCELED", {
        paygLineActive: false,
        stripeSubscriptionId: null,
      });
      return { handled: true };
    }
  }

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subId = invoiceSubscriptionId(invoice);
    const md = (invoice.metadata || {}) as Record<string, string | undefined>;
    if (md.product === "mass_texting" && md.workspaceId && md.monthlyTier) {
      const account = await getOrCreateMassTextingBillingAccount(md.workspaceId);
      await updateMassTextingLifecycle(md.workspaceId, account.lifecycleState, {
        monthlySegmentsUsed: 0,
        billingPeriodStart: invoice.period_start
          ? new Date(invoice.period_start * 1000)
          : undefined,
        billingPeriodEnd: invoice.period_end
          ? new Date(invoice.period_end * 1000)
          : undefined,
      });
      return { handled: true };
    }
    if (subId && md.product === "mass_texting") {
      return { handled: true };
    }
  }

  return { handled: false };
}

export function isMassTextingSubscription(subscription: Stripe.Subscription): boolean {
  const md = (subscription.metadata || {}) as Record<string, string | undefined>;
  return md.product === "mass_texting";
}

export function massTextingSubscriptionPeriod(subscription: Stripe.Subscription) {
  return subscriptionBillingPeriod(subscription);
}
