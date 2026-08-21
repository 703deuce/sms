import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import {
  readStripeMetadata,
  resolveMarketplaceTransactionType,
} from "@/lib/payments/stripe-marketplace-metadata";
import {
  resetForwardingUsageForBillingPeriod,
  upsertNumberServiceSubscriptionFromStripe,
} from "@/lib/payments/number-service-subscription";
import { invoiceSubscriptionId } from "@/lib/payments/stripe-type-helpers";

function subscriptionMetadata(subscription: Stripe.Subscription): Record<string, string> {
  return readStripeMetadata(subscription.metadata);
}

export function isMarketplaceStripeSubscription(subscription: Stripe.Subscription): boolean {
  return resolveMarketplaceTransactionType(subscriptionMetadata(subscription)) === "marketplace_subscription";
}

export async function handleMarketplaceSubscriptionStripeEvent(subscription: Stripe.Subscription) {
  const metadata = subscriptionMetadata(subscription);
  if (resolveMarketplaceTransactionType(metadata) !== "marketplace_subscription") {
    return { skipped: true as const };
  }
  const row = await upsertNumberServiceSubscriptionFromStripe(subscription, metadata);
  return { ok: true as const, subscriptionId: row.id, status: row.status };
}

export async function handleMarketplaceSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  const metadata = readStripeMetadata(session.metadata as Record<string, string>);
  if (resolveMarketplaceTransactionType(metadata) !== "marketplace_subscription") {
    return { skipped: true as const };
  }
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) return { skipped: true as const, reason: "missing_subscription" as const };

  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return handleMarketplaceSubscriptionStripeEvent(subscription);
}

export async function handleMarketplaceSubscriptionInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return { skipped: true as const };

  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscriptionMetadata(subscription);
  if (resolveMarketplaceTransactionType(metadata) !== "marketplace_subscription") {
    return { skipped: true as const };
  }

  await upsertNumberServiceSubscriptionFromStripe(subscription, metadata);
  if (metadata.service === "forwarding_200") {
    await resetForwardingUsageForBillingPeriod(subscriptionId);
  }
  return { ok: true as const, service: metadata.service };
}

export async function handleMarketplaceSubscriptionInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) return { skipped: true as const };

  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (!isMarketplaceStripeSubscription(subscription)) return { skipped: true as const };
  return handleMarketplaceSubscriptionStripeEvent(subscription);
}
