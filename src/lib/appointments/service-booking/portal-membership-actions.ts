import "server-only";

import { getPrisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe/client";
import { getMerchantConnection } from "@/lib/merchant-payments/connection-store";
import {
  cancelMembershipSubscription,
  pauseMembershipSubscription,
  resumeMembershipSubscription,
  restoreMembershipAfterPaymentRecovery,
} from "./membership-lifecycle";

async function assertSubscriptionForContact(
  workspaceId: string,
  contactId: string,
  subscriptionId: string,
) {
  const prisma = getPrisma();
  const sub = await prisma.serviceMembershipSubscription.findFirst({
    where: { id: subscriptionId, workspaceId, contactId },
    include: { product: true },
  });
  if (!sub) throw new Error("Membership not found");
  return sub;
}

async function stripeAccountForWorkspace(workspaceId: string) {
  const connection = await getMerchantConnection(workspaceId, "STRIPE");
  return connection?.merchantAccountId || null;
}

export async function portalCancelMembership(input: {
  workspaceId: string;
  contactId: string;
  subscriptionId: string;
  mode: "immediate" | "end_of_period";
}) {
  const sub = await assertSubscriptionForContact(
    input.workspaceId,
    input.contactId,
    input.subscriptionId,
  );

  if (sub.stripeSubscriptionId) {
    const stripe = getStripe();
    const account = await stripeAccountForWorkspace(input.workspaceId);
    if (stripe && account) {
      if (input.mode === "immediate") {
        await stripe.subscriptions.cancel(sub.stripeSubscriptionId, {}, { stripeAccount: account });
      } else {
        await stripe.subscriptions.update(
          sub.stripeSubscriptionId,
          { cancel_at_period_end: true },
          { stripeAccount: account },
        );
      }
    }
  }

  return cancelMembershipSubscription(input.subscriptionId, input.mode);
}

export async function portalUndoMembershipCancellation(input: {
  workspaceId: string;
  contactId: string;
  subscriptionId: string;
}) {
  const sub = await assertSubscriptionForContact(
    input.workspaceId,
    input.contactId,
    input.subscriptionId,
  );

  if (sub.stripeSubscriptionId) {
    const stripe = getStripe();
    const account = await stripeAccountForWorkspace(input.workspaceId);
    if (stripe && account) {
      await stripe.subscriptions.update(
        sub.stripeSubscriptionId,
        { cancel_at_period_end: false },
        { stripeAccount: account },
      );
    }
  }

  const prisma = getPrisma();
  const meta = (sub.metadata || {}) as Record<string, unknown>;
  return prisma.serviceMembershipSubscription.update({
    where: { id: sub.id },
    data: {
      status: "active",
      metadata: {
        ...meta,
        cancelAtPeriodEnd: false,
        cancelRequestedAt: null,
      },
    },
  });
}

export async function portalPauseMembership(input: {
  workspaceId: string;
  contactId: string;
  subscriptionId: string;
  pausedUntil?: string;
}) {
  await assertSubscriptionForContact(input.workspaceId, input.contactId, input.subscriptionId);
  const pausedUntil = input.pausedUntil ? new Date(input.pausedUntil) : undefined;
  return pauseMembershipSubscription(input.subscriptionId, pausedUntil);
}

export async function portalResumeMembership(input: {
  workspaceId: string;
  contactId: string;
  subscriptionId: string;
}) {
  const sub = await assertSubscriptionForContact(
    input.workspaceId,
    input.contactId,
    input.subscriptionId,
  );

  if (sub.stripeSubscriptionId) {
    const stripe = getStripe();
    const account = await stripeAccountForWorkspace(input.workspaceId);
    if (stripe && account) {
      await stripe.subscriptions.update(
        sub.stripeSubscriptionId,
        { pause_collection: null as unknown as undefined },
        { stripeAccount: account },
      );
    }
  }

  return resumeMembershipSubscription(input.subscriptionId);
}

export async function portalRetryMembershipPayment(input: {
  workspaceId: string;
  contactId: string;
  subscriptionId: string;
}) {
  const sub = await assertSubscriptionForContact(
    input.workspaceId,
    input.contactId,
    input.subscriptionId,
  );

  if (!sub.stripeSubscriptionId) {
    throw new Error("Online payment retry is not available for this membership");
  }

  const stripe = getStripe();
  const account = await stripeAccountForWorkspace(input.workspaceId);
  if (!stripe || !account) {
    throw new Error("Payment provider is not configured");
  }

  const stripeSub = await stripe.subscriptions.retrieve(
    sub.stripeSubscriptionId,
    {},
    { stripeAccount: account },
  );
  const invoiceId =
    typeof stripeSub.latest_invoice === "string"
      ? stripeSub.latest_invoice
      : stripeSub.latest_invoice?.id;
  if (!invoiceId) throw new Error("No invoice available to retry");

  const invoice = await stripe.invoices.retrieve(invoiceId, {}, { stripeAccount: account });
  if (invoice.status === "paid") {
    await restoreMembershipAfterPaymentRecovery(sub.id);
    return { status: "paid", subscriptionId: sub.id };
  }

  const paymentIntent = (invoice as { payment_intent?: string | { id?: string } }).payment_intent;
  if (!paymentIntent) {
    throw new Error("Payment could not be retried automatically");
  }

  const piId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
  if (!piId) throw new Error("Payment could not be retried automatically");
  const intent = await stripe.paymentIntents.confirm(piId, {}, { stripeAccount: account });

  if (intent.status === "succeeded") {
    await restoreMembershipAfterPaymentRecovery(sub.id);
    return { status: "paid", subscriptionId: sub.id };
  }

  return { status: intent.status, subscriptionId: sub.id };
}
