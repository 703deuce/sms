import type Stripe from "stripe";
import { getPrisma } from "@/lib/db";
import { addCreditsFromStripe } from "@/lib/settings/billing";
import { markPaymentLinkPaid } from "@/lib/payments/create-link";
import {
  isMarketplaceSubscriptionMetadata,
  isSaasBillingMetadata,
  resolveMarketplaceTransactionType,
} from "@/lib/payments/stripe-marketplace-metadata";

export async function updateWorkspacePlanFromSubscription(subscription: Stripe.Subscription) {
  const metadata = (subscription.metadata || {}) as Record<string, string>;
  if (isMarketplaceSubscriptionMetadata(metadata)) {
    return;
  }
  if (resolveMarketplaceTransactionType(metadata) === "marketplace_subscription") {
    return;
  }
  const prisma = getPrisma();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const workspace = await prisma.workspace.findFirst({ where: { stripeCustomerId: customerId } });
  if (!workspace) return;

  const status = subscription.status;
  const metadataPlan =
    (subscription.metadata && (subscription.metadata.plan as string)) ||
    (subscription.items?.data?.[0]?.price?.nickname as string | undefined) ||
    null;

  let billingPlan: string;
  if (status === "canceled" || status === "incomplete_expired") {
    billingPlan = "canceled";
  } else if (status === "past_due" || status === "unpaid") {
    billingPlan = "suspended";
  } else {
    billingPlan = metadataPlan || "growth";
  }

  const active = status === "active" || status === "trialing" || status === "past_due";
  const previousPlan = String(workspace.billingPlan || "").toLowerCase();
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      billingPlan,
      stripeSubscriptionId: active ? subscription.id : null,
    },
  });

  if (
    (billingPlan === "canceled" || billingPlan === "suspended") &&
    (previousPlan === "trial" || previousPlan === "trial_pending_card")
  ) {
    const { markTrialEnded } = await import("@/lib/mctb/onboarding/trial-hold");
    await markTrialEnded(workspace.id).catch(() => undefined);
  }
}

export async function handleBillingCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = (session.metadata || {}) as Record<string, string>;
  if (!isSaasBillingMetadata(metadata)) {
    return;
  }
  if (session.id) {
    await markPaymentLinkPaid(session.id);
  }
  if (metadata.paymentLinkId && !session.id) {
    await getPrisma().paymentLink.updateMany({
      where: { id: metadata.paymentLinkId },
      data: { status: "paid" },
    });
  }

  // 2) Prepaid credit top-ups.
  if (metadata.type === "credits" && metadata.workspaceId) {
    const amountCents = Number(metadata.amountCents || session.amount_total || 0);
    if (amountCents > 0 && session.id) {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;
      await addCreditsFromStripe(
        metadata.workspaceId,
        amountCents,
        session.id,
        paymentIntentId,
        `Credit purchase $${(amountCents / 100).toFixed(2)}`,
      );
    }
  }

  // 3) Subscription checkouts — persist subscription + plan immediately.
  if ((metadata.type === "subscription" || session.mode === "subscription") && metadata.workspaceId) {
    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
    await getPrisma().workspace.update({
      where: { id: metadata.workspaceId },
      data: {
        stripeSubscriptionId: subscriptionId,
        billingPlan: metadata.plan || "growth",
      },
    });
  }
}

export async function handleBillingInvoicePaid(invoice: Stripe.Invoice) {
  const metadata = (invoice.metadata || {}) as Record<string, string>;
  if (resolveMarketplaceTransactionType(metadata) === "marketplace_subscription") {
    return;
  }
  const configuredCents =
    Number(metadata.creditsCents || 0) ||
    Number(process.env.STRIPE_SUBSCRIPTION_CREDITS_CENTS || 0);
  if (configuredCents <= 0 || !invoice.id) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  const prisma = getPrisma();
  const workspaceId =
    metadata.workspaceId ||
    (customerId
      ? (await prisma.workspace.findFirst({ where: { stripeCustomerId: customerId } }))?.id
      : undefined);
  if (!workspaceId) return;

  const rawPaymentIntent = (invoice as unknown as { payment_intent?: unknown }).payment_intent;
  const paymentIntentId =
    typeof rawPaymentIntent === "string"
      ? rawPaymentIntent
      : (rawPaymentIntent as { id?: string } | null | undefined)?.id || null;

  await addCreditsFromStripe(
    workspaceId,
    configuredCents,
    `invoice:${invoice.id}`,
    paymentIntentId,
    `Subscription credits $${(configuredCents / 100).toFixed(2)}`,
  );
}
