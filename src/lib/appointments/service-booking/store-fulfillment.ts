import "server-only";

import { Prisma } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { StoreProductKind } from "./store-checkout";

export type StoreFulfillmentStatus = "processing" | "fulfilled" | "failed";

export type StoreCheckoutSessionPayload = {
  id: string;
  metadata?: Record<string, string | null | undefined> | null;
  subscription?: string | null;
  mode?: string | null;
};

async function runStoreFulfillmentBody(
  session: StoreCheckoutSessionPayload,
  metadata: Record<string, string | undefined>,
) {
  const {
    STORE_MEMBERSHIP_SUBSCRIPTION_TYPE,
    STORE_PURCHASE_TRANSACTION_TYPE,
    fulfillStorePurchase,
  } = await import("./store-checkout");
  const { startMembershipSubscription } = await import("./memberships");
  const txType = metadata.transaction_type;

  if (txType === STORE_MEMBERSHIP_SUBSCRIPTION_TYPE) {
    const workspaceId = metadata.workspaceId;
    const productId = metadata.productId;
    const contactId = metadata.contactId;
    const stripeSubscriptionId =
      typeof session.subscription === "string" ? session.subscription : undefined;
    if (!workspaceId || !productId || !contactId || !stripeSubscriptionId) {
      return { handled: false, skipped: true as const };
    }
    const sub = await startMembershipSubscription(
      workspaceId,
      productId,
      contactId,
      stripeSubscriptionId,
    );
    return { handled: true, result: { kind: "membership" as const, subscriptionId: sub.id } };
  }

  if (txType !== STORE_PURCHASE_TRANSACTION_TYPE) {
    return { handled: false, skipped: true as const };
  }

  const workspaceId = metadata.workspaceId;
  const kind = metadata.kind as StoreProductKind | undefined;
  const productId = metadata.productId;
  const contactId = metadata.contactId;
  if (!workspaceId || !kind || !productId || !contactId) {
    return { handled: false, skipped: true as const };
  }

  const result = await fulfillStorePurchase({
    workspaceId,
    kind,
    productId,
    contactId,
    amountCents: metadata.amountCents ? Number(metadata.amountCents) : undefined,
    recipientName: metadata.recipientName,
    recipientEmail: metadata.recipientEmail,
    giftMessage: metadata.giftMessage,
  });

  return { handled: true, result };
}

/**
 * Durable, idempotent store checkout fulfillment (webhook + success-page poll).
 */
export async function fulfillStoreCheckoutSessionOnce(session: StoreCheckoutSessionPayload) {
  const prisma = getPrisma();
  const metadata = (session.metadata || {}) as Record<string, string | undefined>;
  const workspaceId = metadata.workspaceId;
  const txType = metadata.transaction_type || "unknown";

  if (!workspaceId) {
    return { handled: false, skipped: true as const };
  }

  const existing = await prisma.serviceBookingStoreFulfillment.findUnique({
    where: { stripeSessionId: session.id },
  });

  if (existing?.status === "fulfilled") {
    return {
      handled: true,
      duplicate: true as const,
      result: existing.resultJson,
    };
  }

  if (existing?.status === "failed") {
    return {
      handled: true,
      failed: true as const,
      error: existing.errorMessage || "Fulfillment previously failed",
    };
  }

  let claimId: string;
  try {
    const claim = await prisma.serviceBookingStoreFulfillment.create({
      data: {
        workspaceId,
        stripeSessionId: session.id,
        transactionType: txType,
        status: "processing",
      },
    });
    claimId = claim.id;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const row = await prisma.serviceBookingStoreFulfillment.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (row?.status === "fulfilled") {
        return { handled: true, duplicate: true as const, result: row.resultJson };
      }
      return { handled: true, inFlight: true as const };
    }
    throw err;
  }

  try {
    const outcome = await runStoreFulfillmentBody(session, metadata);
    if (!outcome.handled) {
      await prisma.serviceBookingStoreFulfillment.update({
        where: { id: claimId },
        data: { status: "failed", errorMessage: "Skipped — missing metadata" },
      });
      return outcome;
    }

    await prisma.serviceBookingStoreFulfillment.update({
      where: { id: claimId },
      data: {
        status: "fulfilled",
        resultJson: outcome.result as object,
      },
    });
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fulfillment failed";
    await prisma.serviceBookingStoreFulfillment.update({
      where: { id: claimId },
      data: { status: "failed", errorMessage: message },
    });
    throw err;
  }
}
