/**
 * AI transcription catalog, entitlement math, and Deepgram client contract tests.
 * Run: npx tsx scripts/test-ai-transcription.ts
 */
import assert from "node:assert/strict";
import {
  AI_TRANSCRIPTION_INCLUDED_MINUTES,
  AI_TRANSCRIPTION_TIER_PRICES_CENTS,
} from "../src/lib/products/platform-billing-catalog-definitions";
import {
  getPlatformBillingCatalog,
  listPlatformPurchasableProducts,
  parseCheckoutSelection,
  includedMinutesForAiTranscriptionTier,
} from "../src/lib/products/platform-billing-catalog";
import { audioSecondsToTranscriptionMinutes } from "../src/lib/transcription/minute-math";

const catalog = getPlatformBillingCatalog();

assert.equal(catalog.ai_transcription.tiers.starter.monthlyPriceCents, 799);
assert.equal(catalog.ai_transcription.tiers.business.monthlyPriceCents, 1999);
assert.equal(catalog.ai_transcription.tiers.pro.monthlyPriceCents, 3999);
assert.equal(catalog.ai_transcription.tiers.starter.includedMinutes, 750);
assert.equal(catalog.ai_transcription.tiers.business.includedMinutes, 2000);
assert.equal(catalog.ai_transcription.tiers.pro.includedMinutes, 4000);

for (const tier of ["starter", "business", "pro"] as const) {
  const sel = parseCheckoutSelection(`ai_transcription_${tier}`);
  assert.equal(sel.family, "ai_transcription");
  assert.equal(sel.feature, "ai_transcription");
  assert.equal(sel.tier, tier);
  assert.equal(sel.stripePriceId, catalog.ai_transcription.tiers[tier].stripePriceId);
  assert.equal(
    includedMinutesForAiTranscriptionTier(tier),
    AI_TRANSCRIPTION_INCLUDED_MINUTES[tier],
  );
  assert.equal(
    catalog.ai_transcription.tiers[tier].monthlyPriceCents,
    AI_TRANSCRIPTION_TIER_PRICES_CENTS[tier],
  );
}

const atProducts = listPlatformPurchasableProducts().filter((p) => p.family === "ai_transcription");
// V1 defers ai_transcription purchasability — catalog tiers still exist for future launch.
assert.equal(atProducts.length, 0, "ai_transcription not purchasable in V1");
assert.equal(catalog.ai_transcription.tiers.starter.includedMinutes, AI_TRANSCRIPTION_INCLUDED_MINUTES.starter);

// Independent tier selection: SR pro + AT starter must both resolve
const srPro = parseCheckoutSelection("smart_routing_pro");
const atStarter = parseCheckoutSelection("ai_transcription_starter");
assert.equal(srPro.tier, "pro");
assert.equal(atStarter.tier, "starter");
assert.notEqual(srPro.stripePriceId, atStarter.stripePriceId);

// Minute math: transcription minutes are ceiling of audio seconds / 60, min 1
assert.equal(audioSecondsToTranscriptionMinutes(30), 1);
assert.equal(audioSecondsToTranscriptionMinutes(60), 1);
assert.equal(audioSecondsToTranscriptionMinutes(61), 2);
assert.equal(audioSecondsToTranscriptionMinutes(600), 10);

console.log("test-ai-transcription: ok", {
  productId: catalog.ai_transcription.stripeProductId,
  starterPrice: catalog.ai_transcription.tiers.starter.stripePriceId,
  businessPrice: catalog.ai_transcription.tiers.business.stripePriceId,
  proPrice: catalog.ai_transcription.tiers.pro.stripePriceId,
});
