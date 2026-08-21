import assert from "node:assert/strict";
import { MARKETPLACE_BILLING_CATALOG } from "../src/lib/payments/marketplace-billing-catalog.ts";
import {
  buildNumberPurchaseMetadata,
  buildServiceSubscriptionMetadata,
  resolveMarketplaceTransactionType,
} from "../src/lib/payments/stripe-marketplace-metadata.ts";
import { STRIPE_WEBHOOK_EVENT_TYPES } from "../src/lib/payments/stripe-webhook-handler.ts";

function ok(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`, err);
    process.exitCode = 1;
  }
}

ok("catalog prices match product spec", () => {
  const vault = MARKETPLACE_BILLING_CATALOG.find((p) => p.productKey === "vault");
  const vm = MARKETPLACE_BILLING_CATALOG.find((p) => p.productKey === "voicemail");
  const fwd = MARKETPLACE_BILLING_CATALOG.find((p) => p.productKey === "forwarding_200");
  assert.equal(vault?.amountCents, 299);
  assert.equal(vm?.amountCents, 499);
  assert.equal(fwd?.amountCents, 999);
  assert.equal(fwd?.includedUsageMinutes, 200);
});

ok("number purchase metadata uses transaction_type", () => {
  const meta = buildNumberPurchaseMetadata({
    workspaceId: "ws_1",
    userId: "u_1",
    reservationId: "res_1",
    phoneNumber: "+15551234567",
    amountCents: 799,
    provider: "telnyx",
  });
  assert.equal(meta.transaction_type, "marketplace_number_purchase");
  assert.equal(meta.amountCents, "799");
  assert.equal(
    resolveMarketplaceTransactionType(meta),
    "marketplace_number_purchase",
  );
});

ok("service subscription metadata routes separately from SaaS", () => {
  const meta = buildServiceSubscriptionMetadata({
    workspaceId: "ws_1",
    userId: "u_1",
    phoneNumberId: "pn_1",
    service: "vault",
  });
  assert.equal(meta.transaction_type, "marketplace_subscription");
  assert.equal(meta.service, "vault");
  assert.equal(resolveMarketplaceTransactionType(meta), "marketplace_subscription");
  assert.equal(
    resolveMarketplaceTransactionType({ type: "subscription", workspaceId: "ws_1", plan: "growth" }),
    "saas_subscription",
  );
});

ok("webhook event list is explicit", () => {
  assert.equal(STRIPE_WEBHOOK_EVENT_TYPES.length, 11);
  assert.ok(STRIPE_WEBHOOK_EVENT_TYPES.includes("invoice.payment_failed"));
});

if (process.exitCode) process.exit(process.exitCode);
console.log("marketplace stripe billing unit tests passed");
