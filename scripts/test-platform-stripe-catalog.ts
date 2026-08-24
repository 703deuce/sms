#!/usr/bin/env npx tsx
/**
 * Validates code-owned catalog IDs against live Stripe objects.
 * Run: npx tsx scripts/test-platform-stripe-catalog.ts
 */
import assert from "node:assert/strict";
import { getStripe } from "../src/lib/stripe/client.ts";
import { getPlatformBillingCatalog } from "../src/lib/products/platform-billing-catalog.ts";
import {
  MCTB_TIER_PRICES_CENTS,
  SMART_ROUTING_INCLUDED_MINUTES,
  SMART_ROUTING_TIER_PRICES_CENTS,
  AI_TRANSCRIPTION_INCLUDED_MINUTES,
  AI_TRANSCRIPTION_TIER_PRICES_CENTS,
} from "../src/lib/products/platform-billing-catalog-definitions.ts";

async function main() {
  const stripe = getStripe();
  if (!stripe) throw new Error("Stripe not configured");
  const catalog = getPlatformBillingCatalog();
  const results: Array<{ label: string; pass: boolean; detail?: string }> = [];

  async function checkPrice(
    label: string,
    priceId: string,
    expectedCents: number,
    extra?: Record<string, string>,
  ) {
    const price = await stripe.prices.retrieve(priceId);
    const pass =
      price.active &&
      price.currency === "usd" &&
      price.unit_amount === expectedCents &&
      price.recurring?.interval === "month";
    results.push({
      label,
      pass,
      detail: pass
        ? priceId
        : `amount=${price.unit_amount} active=${price.active}`,
    });
    if (extra?.included_minutes) {
      assert.equal(price.metadata?.included_minutes, extra.included_minutes);
    }
  }

  for (const tier of ["starter", "growth", "pro"] as const) {
    await checkPrice(
      `MCTB ${tier}`,
      catalog.mctb.tiers[tier].stripePriceId,
      MCTB_TIER_PRICES_CENTS[tier],
    );
  }

  for (const tier of ["starter", "business", "pro"] as const) {
    await checkPrice(
      `SR ${tier}`,
      catalog.smart_routing.tiers[tier].stripePriceId,
      SMART_ROUTING_TIER_PRICES_CENTS[tier],
      { included_minutes: String(SMART_ROUTING_INCLUDED_MINUTES[tier]) },
    );
  }

  for (const tier of ["starter", "business", "pro"] as const) {
    await checkPrice(
      `AT ${tier}`,
      catalog.ai_transcription.tiers[tier].stripePriceId,
      AI_TRANSCRIPTION_TIER_PRICES_CENTS[tier],
      { included_minutes: String(AI_TRANSCRIPTION_INCLUDED_MINUTES[tier]) },
    );
  }

  const coupon = await stripe.coupons.retrieve(catalog.discounts.dualProduct.stripeCouponId);
  assert.equal(coupon.percent_off, 20);
  results.push({ label: "Dual-product coupon 20%", pass: coupon.valid === true });

  const failed = results.filter((r) => !r.pass);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
