/**
 * Delivery status + analytics tests
 * Run: npx tsx scripts/test-messaging-delivery-analytics.ts
 */
import assert from "node:assert/strict";
import {
  failureCategoryLabel,
  normalizeDeliveryError,
} from "../src/lib/messaging/delivery-errors";
import {
  DELIVERY_STATUS_RANK,
  resolveInternalDeliveryStatus,
  statusesAtOrBelowRank,
} from "../src/lib/messaging/delivery-status";
import { summarizeDeliveryStatuses } from "../src/lib/automate/delivery-stats";
import { buildSmsPlatformNav } from "../src/lib/products/sms-platform-nav";
import { settingsTabs } from "../src/lib/settings-tabs";

// Error normalization
const invalid = normalizeDeliveryError({ provider: "twilio", errorCode: "21211" });
assert.equal(invalid.category, "invalid_number");
assert.ok(invalid.explanation.includes("could not receive"));

const landline = normalizeDeliveryError({
  provider: "twilio",
  errorCode: "30006",
  errorDetail: "Landline",
});
assert.equal(landline.category, "landline_unsupported");

assert.equal(failureCategoryLabel("carrier_rejected"), "Carrier rejected");

// Status rank monotonicity
assert.ok(DELIVERY_STATUS_RANK.delivered > DELIVERY_STATUS_RANK.sent);
assert.ok(statusesAtOrBelowRank(DELIVERY_STATUS_RANK.sent).includes("queued"));

const resolved = resolveInternalDeliveryStatus({
  providerMessageId: "x",
  providerStatus: "delivery_failed",
  internalStatus: "failed",
  raw: {},
});
assert.equal(resolved, "failed");

// Sent is NOT delivered
const stats = summarizeDeliveryStatuses(["sent", "delivered", "failed", "queued"]);
assert.equal(stats.delivered, 1);
assert.equal(stats.failed, 1);
assert.equal(stats.pending, 2);
assert.ok(stats.deliveryRate < 1);

// Nav structure
const nav = buildSmsPlatformNav();
const labels = nav.map((i) => i.label);
assert.ok(labels.includes("Analytics"), "Analytics in main nav");
assert.ok(!labels.includes("Integrations"), "Integrations removed from main nav");
assert.ok(settingsTabs.some((t) => t.href === "/settings/integrations"));

console.log("test-messaging-delivery-analytics: ok");
