/**
 * MCTB commercial Stripe / entitlement lifecycle (DB + webhook handlers, no live card charge).
 *
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-mctb-commercial-stripe-entitlement-lifecycle.ts
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { getPrisma } from "../src/lib/db";
import { resolveMctbCapabilities } from "../src/lib/mctb/capabilities";
import { resolveMctbCommercialEntitlements } from "../src/lib/mctb/commercial-entitlements";
import {
  applyMctbCommercialAddonProductKey,
  MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS,
} from "../src/lib/mctb/commercial-entitlement-grants";
import {
  resolveMctbMonthlyRecoveryLimit,
  MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT,
  MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT,
  MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
} from "../src/lib/mctb/recovery-usage-constants";
import { grantWorkspaceProductFeature } from "../src/lib/products/feature-entitlements";
import { handlePlatformCheckoutCompleted, handlePlatformSubscriptionEvent } from "../src/lib/payments/stripe-platform-webhook";
import {
  mctbEstimatedMonthlyTotalCents,
  MCTB_OWN_SENDER_MONTHLY_CENTS,
  MCTB_TEXT_BACK_MONTHLY_CENTS,
  MCTB_AI_RECOVERY_MONTHLY_CENTS,
} from "../src/lib/mctb/commercial-pricing";

const DATABASE_URL = process.env.DATABASE_URL?.trim();
if (!DATABASE_URL) {
  console.log("test-mctb-commercial-stripe-entitlement-lifecycle: SKIP (no DATABASE_URL)");
  process.exit(0);
}

async function createWorkspace() {
  const prisma = getPrisma();
  const id = `mctb_stripe_${randomUUID().slice(0, 10)}`;
  await prisma.workspace.create({
    data: {
      id,
      name: "MCTB stripe lifecycle test",
      slug: `mctb-stripe-${randomUUID().slice(0, 8)}`,
      type: "BUSINESS",
      billingPlan: "trial",
    },
  });
  await grantWorkspaceProductFeature(id, "mctb", "active");
  return id;
}

async function cleanup(workspaceId: string) {
  const prisma = getPrisma();
  await prisma.platformProductSubscription.deleteMany({ where: { workspaceId } });
  await prisma.workspaceLimits.deleteMany({ where: { workspaceId } });
  await prisma.workspaceProductFeature.deleteMany({ where: { workspaceId } });
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}

function mockAddonSubscription(
  workspaceId: string,
  productFamily: "mctb_ai_recovery" | "mctb_own_sender",
  productKey: string,
): Stripe.Subscription {
  return {
    id: `sub_test_${randomUUID().slice(0, 8)}`,
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    metadata: {
      workspaceId,
      platformProductFamily: productFamily,
      platformProductKey: productKey,
      platformTier: "default",
    },
    customer: "cus_test",
    items: { object: "list", data: [], has_more: false, url: "" },
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
  } as Stripe.Subscription;
}

function mockMctbSubscription(
  workspaceId: string,
  tier: "starter" | "growth" | "pro",
): Stripe.Subscription {
  return {
    id: `sub_test_${randomUUID().slice(0, 8)}`,
    object: "subscription",
    status: "active",
    cancel_at_period_end: false,
    metadata: {
      workspaceId,
      platformProductFamily: "mctb",
      platformProductKey: `mctb_${tier}`,
      platformTier: tier,
    },
    customer: "cus_test",
    items: { object: "list", data: [], has_more: false, url: "" },
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
  } as Stripe.Subscription;
}

async function main() {
  const workspaceId = await createWorkspace();

  try {
    let caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.recoveryPaid, false, "free workspace starts unpaid recovery");
    assert.equal(caps.monthlyRecoveryLimit, MCTB_FREE_MONTHLY_RECOVERY_LIMIT);
    assert.equal(caps.aiRecoveryEntitled, false);
    assert.equal(caps.ownSenderAddOnEntitled, false);

    assert.equal(
      mctbEstimatedMonthlyTotalCents({ basePlan: "free", ownSenderAddOn: true }),
      MCTB_OWN_SENDER_MONTHLY_CENTS,
    );
    assert.equal(
      mctbEstimatedMonthlyTotalCents({ basePlan: "text_back", ownSenderAddOn: true }),
      MCTB_TEXT_BACK_MONTHLY_CENTS + MCTB_OWN_SENDER_MONTHLY_CENTS,
    );
    assert.equal(
      mctbEstimatedMonthlyTotalCents({ basePlan: "ai_recovery", ownSenderAddOn: true }),
      MCTB_AI_RECOVERY_MONTHLY_CENTS + MCTB_OWN_SENDER_MONTHLY_CENTS,
    );

    const ownOnly = mockAddonSubscription(
      workspaceId,
      "mctb_own_sender",
      MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.ownSender,
    );
    await handlePlatformSubscriptionEvent(ownOnly);
    caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.recoveryPaid, false, "own sender alone does not imply Text Back paid");
    assert.equal(caps.ownSenderAddOnEntitled, true);
    assert.equal(caps.monthlyRecoveryLimit, MCTB_FREE_MONTHLY_RECOVERY_LIMIT);
    await handlePlatformSubscriptionEvent({ ...ownOnly, status: "canceled" } as Stripe.Subscription);

    const subStarter = mockMctbSubscription(workspaceId, "starter");
    const upsert = await handlePlatformSubscriptionEvent(subStarter);
    assert.equal(upsert.handled, true);

    caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.recoveryPaid, true);
    assert.equal(caps.monthlyRecoveryLimit, MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT);

    const subGrowth = mockMctbSubscription(workspaceId, "growth");
    await handlePlatformSubscriptionEvent(subGrowth);
    caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.monthlyRecoveryLimit, MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT);

    const subPro = mockMctbSubscription(workspaceId, "pro");
    await handlePlatformSubscriptionEvent(subPro);
    caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.monthlyRecoveryLimit, MCTB_TEXT_BACK_MONTHLY_RECOVERY_LIMIT);

    await applyMctbCommercialAddonProductKey(
      workspaceId,
      MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.aiRecovery,
      true,
    );
    caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.aiRecoveryEntitled, true);
    assert.equal(caps.monthlyRecoveryLimit, MCTB_AI_RECOVERY_MONTHLY_RECOVERY_LIMIT);
    assert.equal(caps.urgentClassification, true, "urgency detection is AI Recovery only");
    assert.equal(caps.bookingLinks, true);

    await applyMctbCommercialAddonProductKey(
      workspaceId,
      MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.ownSender,
      true,
    );
    caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.ownSenderAddOnEntitled, true);
    assert.equal(caps.platformSenderActive, true, "platform sender until own sender verified");

    const checkout = await handlePlatformCheckoutCompleted({
      id: `cs_test_${randomUUID().slice(0, 6)}`,
      object: "checkout.session",
      metadata: {
        workspaceId,
        platformProductKey: MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.aiRecovery,
      },
    } as Stripe.Checkout.Session);
    assert.equal(checkout.handled, true);

    const canceled = {
      ...subPro,
      status: "canceled" as const,
    };
    await handlePlatformSubscriptionEvent(canceled, "customer.subscription.deleted");
    const commercial = await resolveMctbCommercialEntitlements(workspaceId);
    assert.equal(commercial.recoveryPaid, false, "canceled mctb sub removes recovery paid");

    await applyMctbCommercialAddonProductKey(
      workspaceId,
      MCTB_COMMERCIAL_ADDON_PRODUCT_KEYS.ownSender,
      false,
    );
    caps = await resolveMctbCapabilities(workspaceId);
    assert.equal(caps.ownSenderAddOnEntitled, false);
    assert.equal(caps.customTemplates, false);

    assert.equal(
      resolveMctbMonthlyRecoveryLimit({
        mctbProductActive: true,
        recoveryPaid: false,
        paidTier: null,
      }),
      MCTB_FREE_MONTHLY_RECOVERY_LIMIT,
    );

    console.log("test-mctb-commercial-stripe-entitlement-lifecycle: PASS");
  } finally {
    await cleanup(workspaceId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
