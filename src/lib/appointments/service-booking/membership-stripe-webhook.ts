import "server-only";

import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
import { invoiceSubscriptionId, subscriptionBillingPeriod } from "@/lib/payments/stripe-type-helpers";
import { STORE_MEMBERSHIP_SUBSCRIPTION_TYPE } from "./store-checkout";

function readMetadata(
  metadata: Stripe.Metadata | Record<string, string | undefined> | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!metadata) return out;
  for (const [key, value] of Object.entries(metadata)) {
    if (value != null) out[key] = String(value);
  }
  return out;
}

export function isMembershipStripeSubscription(subscription: Stripe.Subscription): boolean {
  const metadata = readMetadata(subscription.metadata);
  return metadata.transaction_type === STORE_MEMBERSHIP_SUBSCRIPTION_TYPE;
}

function mapStripeStatus(
  stripeStatus: string,
  cancelAtPeriodEnd: boolean,
): string {
  if (cancelAtPeriodEnd && stripeStatus === "active") return "cancelling";
  if (stripeStatus === "active" || stripeStatus === "trialing") return stripeStatus === "trialing" ? "trialing" : "active";
  if (stripeStatus === "past_due" || stripeStatus === "unpaid") return "past_due";
  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") return "canceled";
  if (stripeStatus === "paused") return "paused";
  return stripeStatus;
}

async function appendActivity(
  subscriptionId: string,
  entry: { event: string; status?: string; billingCents?: number },
) {
  const prisma = getPrisma();
  const sub = await prisma.serviceMembershipSubscription.findUnique({
    where: { id: subscriptionId },
  });
  if (!sub) return;
  const meta = (sub.metadata || {}) as {
    activity?: Array<{ event: string; at: string; status?: string; billingCents?: number }>;
  };
  const activity = [...(meta.activity || []), { ...entry, at: new Date().toISOString() }];
  await prisma.serviceMembershipSubscription.update({
    where: { id: subscriptionId },
    data: { metadata: { ...meta, activity } },
  });
}

export async function syncMembershipSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const metadata = readMetadata(subscription.metadata);
  if (!isMembershipStripeSubscription(subscription)) {
    return { skipped: true as const };
  }

  const prisma = getPrisma();
  const stripeSubscriptionId = subscription.id;
  const { periodEnd } = subscriptionBillingPeriod(subscription);
  const mappedStatus = mapStripeStatus(
    subscription.status,
    subscription.cancel_at_period_end === true,
  );

  let row = await prisma.serviceMembershipSubscription.findFirst({
    where: { stripeSubscriptionId },
  });

  if (!row && metadata.workspaceId && metadata.productId && metadata.contactId) {
    const product = await prisma.serviceMembershipProduct.findFirst({
      where: { id: metadata.productId, workspaceId: metadata.workspaceId },
    });
    if (product) {
      row = await prisma.serviceMembershipSubscription.create({
        data: {
          workspaceId: metadata.workspaceId,
          productId: metadata.productId,
          contactId: metadata.contactId,
          status: mappedStatus === "cancelling" ? "active" : mappedStatus,
          stripeSubscriptionId,
          currentPeriodEnd: periodEnd,
          benefitsSnapshot: product.benefits,
          metadata: {
            cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
            stripeStatus: subscription.status,
          },
        },
      });
      await appendActivity(row.id, {
        event: "Membership purchased",
        status: "Succeeded",
        billingCents: product.priceCents,
      });
      return { ok: true as const, subscriptionId: row.id, created: true };
    }
  }

  if (!row) {
    return { skipped: true as const, reason: "subscription_not_found" as const };
  }

  const previousStatus = row.status;
  const nextMeta = {
    ...(row.metadata as object),
    cancelAtPeriodEnd: subscription.cancel_at_period_end === true,
    stripeStatus: subscription.status,
    ...(subscription.cancel_at_period_end
      ? { cancelRequestedAt: new Date().toISOString() }
      : {}),
  };

  await prisma.serviceMembershipSubscription.update({
    where: { id: row.id },
    data: {
      status: mappedStatus === "cancelling" ? "active" : mappedStatus,
      currentPeriodEnd: periodEnd,
      metadata: nextMeta,
    },
  });

  if (previousStatus !== mappedStatus && mappedStatus !== "cancelling") {
    const event =
      mappedStatus === "past_due"
        ? "Payment failed"
        : mappedStatus === "canceled"
          ? "Cancelled"
          : mappedStatus === "active" && previousStatus === "past_due"
            ? "Recovered"
            : "Status updated";
    await appendActivity(row.id, { event, status: mappedStatus });
  }

  if (subscription.cancel_at_period_end && !((row.metadata as { cancelAtPeriodEnd?: boolean })?.cancelAtPeriodEnd)) {
    await appendActivity(row.id, { event: "Cancellation scheduled", status: "Cancelling" });
  }

  return { ok: true as const, subscriptionId: row.id, status: mappedStatus };
}

export async function handleMembershipSubscriptionStripeEvent(
  subscription: Stripe.Subscription,
  eventType?: string,
) {
  if (!isMembershipStripeSubscription(subscription)) {
    return { skipped: true as const };
  }

  if (eventType === "customer.subscription.deleted" || subscription.status === "canceled") {
    const prisma = getPrisma();
    const row = await prisma.serviceMembershipSubscription.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });
    if (row) {
      await prisma.serviceMembershipSubscription.update({
        where: { id: row.id },
        data: {
          status: "canceled",
          metadata: {
            ...(row.metadata as object),
            canceledAt: new Date().toISOString(),
          },
        },
      });
      await appendActivity(row.id, { event: "Cancelled", status: "Canceled" });
      return { ok: true as const, subscriptionId: row.id, canceled: true };
    }
  }

  return syncMembershipSubscriptionFromStripe(subscription);
}

export async function handleMembershipInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return { skipped: true as const };

  const prisma = getPrisma();
  const row = await prisma.serviceMembershipSubscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { product: true },
  });
  if (!row) return { skipped: true as const };

  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = getStripe();
  const stripeSub = stripe ? await stripe.subscriptions.retrieve(subscriptionId) : null;
  const { periodEnd } = stripeSub
    ? subscriptionBillingPeriod(stripeSub)
    : { periodEnd: row.currentPeriodEnd };

  const wasPastDue = row.status === "past_due";
  await prisma.serviceMembershipSubscription.update({
    where: { id: row.id },
    data: {
      status: "active",
      currentPeriodEnd: periodEnd ?? row.currentPeriodEnd,
      metadata: {
        ...(row.metadata as object),
        usage: {},
        lastRenewalAt: new Date().toISOString(),
      },
    },
  });

  await appendActivity(row.id, {
    event: wasPastDue ? "Recovered" : "Renewal payment",
    status: "Succeeded",
    billingCents: row.product?.priceCents,
  });

  return { ok: true as const, subscriptionId: row.id, recovered: wasPastDue };
}

export async function handleMembershipInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return { skipped: true as const };

  const prisma = getPrisma();
  const row = await prisma.serviceMembershipSubscription.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    include: { product: true },
  });
  if (!row) return { skipped: true as const };

  await prisma.serviceMembershipSubscription.update({
    where: { id: row.id },
    data: { status: "past_due" },
  });
  await appendActivity(row.id, {
    event: "Payment failed",
    status: "Past due",
    billingCents: row.product?.priceCents,
  });

  return { ok: true as const, subscriptionId: row.id, status: "past_due" };
}
