import type Stripe from "stripe";

type InvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
};

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
};

export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const raw = (invoice as InvoiceWithSubscription).subscription;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id ?? null;
}

export function subscriptionBillingPeriod(subscription: Stripe.Subscription): {
  periodStart: Date | null;
  periodEnd: Date | null;
} {
  const sub = subscription as SubscriptionWithPeriod;
  return {
    periodStart: sub.current_period_start
      ? new Date(sub.current_period_start * 1000)
      : null,
    periodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
  };
}
