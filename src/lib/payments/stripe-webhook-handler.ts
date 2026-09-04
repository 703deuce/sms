import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { emitMarketplaceAlert } from "@/lib/ops/marketplace-alerts";
import {
  handleBillingCheckoutSessionCompleted,
  handleBillingInvoicePaid,
  updateWorkspacePlanFromSubscription,
} from "@/lib/payments/stripe-billing-webhook";
import {
  handlePremiumNumberCheckoutFailed,
  handlePremiumNumberCheckoutSession,
  handlePremiumNumberPaymentIntentFailed,
  handlePremiumNumberPaymentIntentSucceeded,
  isPremiumNumberCheckoutMetadata,
} from "@/lib/payments/stripe-number-purchase-webhook";
import {
  isMarketplaceSubscriptionMetadata,
  isSaasBillingMetadata,
  resolveMarketplaceTransactionType,
} from "@/lib/payments/stripe-marketplace-metadata";
import {
  handleMarketplaceSubscriptionCheckoutCompleted,
  handleMarketplaceSubscriptionInvoiceFailed,
  handleMarketplaceSubscriptionInvoicePaid,
  handleMarketplaceSubscriptionStripeEvent,
  isMarketplaceStripeSubscription,
} from "@/lib/payments/stripe-service-subscription-webhook";
import {
  handlePlatformCheckoutCompleted,
  handlePlatformInvoicePaid,
  handlePlatformInvoiceUpcoming,
  handlePlatformSubscriptionEvent,
} from "@/lib/payments/stripe-platform-webhook";
import { isPlatformProductSubscription } from "@/lib/products/platform-subscriptions";
import { invoiceSubscriptionId } from "@/lib/payments/stripe-type-helpers";

type MinimalEvent = {
  id?: string;
  type?: string;
  data?: { object?: Record<string, unknown> };
};

function metadataFromObject(obj: Record<string, unknown>): Record<string, string | undefined> {
  const raw = obj.metadata;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, string | undefined>;
}

function checkoutTransactionType(session: Stripe.Checkout.Session) {
  return resolveMarketplaceTransactionType((session.metadata || {}) as Record<string, string>);
}

async function routeCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const tx = checkoutTransactionType(session);
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  const { isMassTextingCheckoutMetadata, handleMassTextingCheckoutCompleted } = await import(
    "@/lib/mass-texting/stripe-webhook"
  );
  if (isMassTextingCheckoutMetadata(metadata)) {
    return handleMassTextingCheckoutCompleted(session);
  }
  const platformProductKey = session.metadata?.platformProductKey;
  const platformWorkspaceId = session.metadata?.workspaceId;
  if (platformProductKey && platformWorkspaceId) {
    return handlePlatformCheckoutCompleted(session);
  }
  if (tx === "marketplace_number_purchase" || isPremiumNumberCheckoutMetadata(session.metadata as Record<string, string>)) {
    return handlePremiumNumberCheckoutSession(session);
  }
  if (tx === "marketplace_subscription" || isMarketplaceSubscriptionMetadata(session.metadata as Record<string, string>)) {
    return handleMarketplaceSubscriptionCheckoutCompleted(session);
  }
  if (isSaasBillingMetadata(session.metadata as Record<string, string>)) {
    await handleBillingCheckoutSessionCompleted(session);
    return { subsystem: "saas_billing" as const };
  }
  const { isAppointmentCheckoutMetadata, handleAppointmentCheckoutCompleted } = await import(
    "@/lib/appointments/payment-checkout"
  );
  if (isAppointmentCheckoutMetadata(metadata)) {
    return handleAppointmentCheckoutCompleted(session);
  }
  return { subsystem: "none" as const, skipped: true };
}

async function routeCheckoutSessionAsyncSucceeded(session: Stripe.Checkout.Session) {
  return routeCheckoutSessionCompleted(session);
}

async function routeCheckoutSessionAsyncFailed(session: Stripe.Checkout.Session) {
  const tx = checkoutTransactionType(session);
  if (tx === "marketplace_number_purchase") {
    return handlePremiumNumberCheckoutFailed(session);
  }
  return { subsystem: "none" as const, skipped: true };
}

async function routeSubscriptionEvent(
  subscription: Stripe.Subscription,
  eventType?: string,
) {
  if (isPlatformProductSubscription(subscription)) {
    return handlePlatformSubscriptionEvent(subscription, eventType);
  }

  const metadata = (subscription.metadata || {}) as Record<string, string | undefined>;
  const platformProductKey = metadata.platformProductKey;
  const workspaceId = metadata.workspaceId;

  if (platformProductKey && workspaceId) {
    const { grantsForPlatformProduct } = await import(
      "@/lib/products/platform-billing-catalog"
    );
    const { grantWorkspaceProductFeature } = await import(
      "@/lib/products/feature-entitlements"
    );
    const features = grantsForPlatformProduct(platformProductKey);
    const isDeleted =
      eventType === "customer.subscription.deleted" ||
      subscription.status === "canceled" ||
      subscription.status === "unpaid";
    for (const feature of features) {
      await grantWorkspaceProductFeature(
        workspaceId,
        feature,
        isDeleted ? "inactive" : "active",
      );
    }
    return {
      subsystem: "platform_product" as const,
      productKey: platformProductKey,
      deactivated: isDeleted,
    };
  }

  if (isMarketplaceStripeSubscription(subscription)) {
    return handleMarketplaceSubscriptionStripeEvent(subscription);
  }
  await updateWorkspacePlanFromSubscription(subscription);
  return { subsystem: "saas_billing" as const };
}

async function routeInvoicePaid(invoice: Stripe.Invoice) {
  await handlePlatformInvoicePaid(invoice);
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (subscriptionId) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (isMarketplaceStripeSubscription(subscription)) {
          return handleMarketplaceSubscriptionInvoicePaid(invoice);
        }
      } catch {
        // fall through to SaaS billing invoice handler
      }
    }
  }
  await handleBillingInvoicePaid(invoice);
  return { subsystem: "saas_billing" as const };
}

async function routeInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (subscriptionId) {
    const stripe = getStripe();
    if (stripe) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        if (isMarketplaceStripeSubscription(subscription)) {
          return handleMarketplaceSubscriptionInvoiceFailed(invoice);
        }
      } catch {
        // ignore
      }
    }
  }
  return { subsystem: "none" as const, skipped: true };
}

async function processStripeEvent(event: Stripe.Event) {
  const { handleMassTextingStripeEvent } = await import("@/lib/mass-texting/stripe-webhook");
  const massTextResult = await handleMassTextingStripeEvent(event);
  if (massTextResult.handled) {
    return { subsystem: "mass_texting" as const };
  }

  const obj = event.data.object as unknown as Record<string, unknown>;

  switch (event.type) {
    case "checkout.session.completed":
      return routeCheckoutSessionCompleted(obj as unknown as Stripe.Checkout.Session);
    case "checkout.session.async_payment_succeeded":
      return routeCheckoutSessionAsyncSucceeded(obj as unknown as Stripe.Checkout.Session);
    case "checkout.session.async_payment_failed":
      return routeCheckoutSessionAsyncFailed(obj as unknown as Stripe.Checkout.Session);
    case "invoice.upcoming":
      await handlePlatformInvoiceUpcoming(obj as unknown as Stripe.Invoice);
      return { subsystem: "platform_product" as const, action: "overage_billed" };
    case "invoice.paid":
    case "invoice.payment_succeeded":
      return routeInvoicePaid(obj as unknown as Stripe.Invoice);
    case "invoice.payment_failed":
      return routeInvoiceFailed(obj as unknown as Stripe.Invoice);
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return routeSubscriptionEvent(obj as unknown as Stripe.Subscription, event.type);
    case "payment_intent.succeeded":
      if (isPremiumNumberCheckoutMetadata(metadataFromObject(obj))) {
        return handlePremiumNumberPaymentIntentSucceeded(obj as unknown as Stripe.PaymentIntent);
      }
      return { subsystem: "none" as const, skipped: true };
    case "payment_intent.payment_failed":
      if (isPremiumNumberCheckoutMetadata(metadataFromObject(obj))) {
        return handlePremiumNumberPaymentIntentFailed(obj as unknown as Stripe.PaymentIntent);
      }
      return { subsystem: "none" as const, skipped: true };
    default:
      return { subsystem: "none" as const, skipped: true };
  }
}

export async function verifyAndParseStripeWebhook(request: Request): Promise<{
  event: Stripe.Event;
  rawBody: string;
}> {
  const rawBody = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const stripe = getStripe();

  if (secret && stripe) {
    const sig = request.headers.get("stripe-signature");
    if (!sig) {
      throw new Response(JSON.stringify({ error: "missing signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    try {
      return {
        event: stripe.webhooks.constructEvent(rawBody, sig, secret) as Stripe.Event,
        rawBody,
      };
    } catch (err) {
      throw new Response(
        JSON.stringify({
          error: `signature verification failed: ${err instanceof Error ? err.message : "invalid"}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const parsed = JSON.parse(rawBody) as MinimalEvent;
  return {
    event: parsed as unknown as Stripe.Event,
    rawBody,
  };
}

export async function handleStripeWebhookRequest(request: Request): Promise<Response> {
  let event: Stripe.Event;
  try {
    ({ event } = await verifyAndParseStripeWebhook(request));
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid webhook payload" },
      { status: 400 },
    );
  }

  const providerEventId = event.id || `${event.type}:${Date.now()}`;
  const prisma = getPrisma();

  const existing = await prisma.providerWebhookEvent.findUnique({
    where: { providerEventId },
  });
  if (existing?.status === "processed") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await prisma.providerWebhookEvent.upsert({
    where: { providerEventId },
    create: {
      provider: "stripe",
      eventType: event.type,
      providerEventId,
      payload: event as object,
      status: "received",
    },
    update: {
      eventType: event.type,
      payload: event as object,
    },
  });

  try {
    const result = await processStripeEvent(event);
    await prisma.providerWebhookEvent.update({
      where: { providerEventId },
      data: {
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
      },
    });
    return NextResponse.json({ received: true, ...result });
  } catch (err) {
    console.error("[stripe/webhook]", err);
    await prisma.providerWebhookEvent.update({
      where: { providerEventId },
      data: {
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "Webhook failed",
      },
    });
    await emitMarketplaceAlert({
      severity: "critical",
      category: "stripe_webhook_failed",
      message: "Stripe webhook processing failed",
      error: err instanceof Error ? err.message : "Webhook failed",
    });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 400 },
    );
  }
}

/** Stripe event types this endpoint must subscribe to in the Stripe Dashboard. */
export const STRIPE_WEBHOOK_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
] as const;

export type StripeWebhookEventType = (typeof STRIPE_WEBHOOK_EVENT_TYPES)[number];
