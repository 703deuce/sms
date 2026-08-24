/**
 * Platform bundle pricing + catalog contract tests.
 * Run: npx tsx scripts/test-platform-bundle-pricing.ts
 */
import assert from "node:assert/strict";
import {
  BUNDLE_PRICING_MATRIX,
  bundleMonthlyTotalCents,
} from "../src/lib/products/platform-bundle-pricing";
import {
  getPlatformBillingCatalog,
  listPlatformPurchasableProducts,
  parseCheckoutSelection,
  platformPriceIdFromEnv,
} from "../src/lib/products/platform-billing-catalog";
import {
  MCTB_TIER_PRICES_CENTS,
  SMART_ROUTING_INCLUDED_MINUTES,
  SMART_ROUTING_TIER_PRICES_CENTS,
} from "../src/lib/products/platform-billing-catalog-definitions";
import { conversationMinutesFromSession } from "../src/lib/smart-routing/conversation-minute-math";

for (const row of BUNDLE_PRICING_MATRIX) {
  const { totalCents } = bundleMonthlyTotalCents(row.mctbTier, row.srTier, true);
  const expectedCents = Math.round(row.expectedTotalDollars * 100);
  assert.equal(
    totalCents,
    expectedCents,
    `bundle ${row.mctbTier}+${row.srTier} expected ${expectedCents} got ${totalCents}`,
  );
}

assert.equal(platformPriceIdFromEnv("mctb_starter"), null, "no env price overrides");

const catalog = getPlatformBillingCatalog();
assert.equal(catalog.mctb.tiers.starter.monthlyPriceCents, 1999);
assert.equal(catalog.mctb.tiers.growth.monthlyPriceCents, 2999);
assert.equal(catalog.mctb.tiers.pro.monthlyPriceCents, 4999);
assert.equal(catalog.smart_routing.tiers.starter.includedMinutes, 750);
assert.equal(catalog.smart_routing.tiers.business.includedMinutes, 2000);
assert.equal(catalog.smart_routing.tiers.pro.includedMinutes, 4000);
assert.ok(catalog.mctb.tiers.starter.stripePriceId.startsWith("price_"));
assert.ok(catalog.discounts.dualProduct.stripeCouponId.length > 0);

const products = listPlatformPurchasableProducts();
assert.equal(products.filter((p) => p.family === "mctb").length, 3);
assert.equal(products.filter((p) => p.family === "smart_routing").length, 3);
assert.equal(products.filter((p) => p.family === "ai_transcription").length, 3);

for (const atTier of ["starter", "business", "pro"] as const) {
  const at = parseCheckoutSelection(`ai_transcription_${atTier}`);
  assert.equal(at.stripePriceId, catalog.ai_transcription.tiers[atTier].stripePriceId);
}

for (const mctbTier of ["starter", "growth", "pro"] as const) {
  for (const srTier of ["starter", "business", "pro"] as const) {
    const mctb = parseCheckoutSelection(`mctb_${mctbTier}`);
    const sr = parseCheckoutSelection(`smart_routing_${srTier}`);
    assert.equal(mctb.stripePriceId, catalog.mctb.tiers[mctbTier].stripePriceId);
    assert.equal(sr.stripePriceId, catalog.smart_routing.tiers[srTier].stripePriceId);
    assert.equal(MCTB_TIER_PRICES_CENTS[mctbTier] + SMART_ROUTING_TIER_PRICES_CENTS[srTier] > 0, true);
    assert.equal(SMART_ROUTING_INCLUDED_MINUTES[srTier] > 0, true);
  }
}

const tenMin = conversationMinutesFromSession({
  startedAt: new Date("2026-01-01T12:00:00Z"),
  answeredAt: new Date("2026-01-01T12:00:00Z"),
  completedAt: new Date("2026-01-01T12:10:00Z"),
});
assert.equal(tenMin, 10, "10-minute conversation = 10 plan minutes");

console.log("test-platform-bundle-pricing: ok", {
  mode: process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_") ? "test" : "live",
  mctbStarterPrice: catalog.mctb.tiers.starter.stripePriceId,
  dualCoupon: catalog.discounts.dualProduct.stripeCouponId,
});
