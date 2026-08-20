import type Stripe from "stripe";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { emitMarketplaceAlert } from "@/lib/ops/marketplace-alerts";
import { addCreditsFromStripe } from "@/lib/settings/billing";
import { markPaymentLinkPaid } from "@/lib/payments/create-link";

type MinimalEvent = {
  type?: string;
  data?: { object?: Record<string, unknown> };
};

async function updateWorkspacePlanFromSubscription(subscription: Stripe.Subscription) {
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
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: {
      billingPlan,
      stripeSubscriptionId: active ? subscription.id : null,
    },
  });
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const metadata = (session.metadata || {}) as Record<string, string>;

  // 1) Hosted payment links created via create-link.ts (paymentLinkId in metadata).
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

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Grant recurring credits when configured, either via invoice metadata or env.
  const metadata = (invoice.metadata || {}) as Record<string, string>;
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

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    const stripe = getStripe();

    let event: MinimalEvent;

    if (secret && stripe) {
      const sig = request.headers.get("stripe-signature");
      if (!sig) {
        return NextResponse.json({ error: "missing signature" }, { status: 400 });
      }
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, secret) as unknown as MinimalEvent;
      } catch (err) {
        return NextResponse.json(
          { error: `signature verification failed: ${err instanceof Error ? err.message : "invalid"}` },
          { status: 400 },
        );
      }
    } else {
      // No verification secret configured — parse best-effort (dev / mock).
      event = JSON.parse(rawBody) as MinimalEvent;
    }

    const obj = (event.data?.object || {}) as Record<string, unknown>;

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(obj as unknown as Stripe.Checkout.Session);
        break;
      case "invoice.paid":
      case "invoice.payment_succeeded":
        await handleInvoicePaid(obj as unknown as Stripe.Invoice);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await updateWorkspacePlanFromSubscription(obj as unknown as Stripe.Subscription);
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook]", err);
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
