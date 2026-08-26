/**
 * Mass Texting pricing + credit accounting unit tests.
 * Run: npx tsx scripts/test-mass-texting-pricing-billing.ts
 */
import assert from "node:assert/strict";
import {
  MASS_TEXT_MONTHLY_PLANS,
  MASS_TEXT_PAYG_PACKS,
  MASS_TEXT_TRIAL,
  MASS_TEXT_A2P_REGISTRATION_FEE_CENTS,
  MASS_TEXT_PAYG_LINE,
  MASS_TEXT_ADDITIONAL_NUMBER,
  MASS_TEXT_MMS_CREDIT_MULTIPLIER,
  MASS_TEXT_MMS_PRODUCTION_ENABLED,
  creditsForRenderedMessage,
  massTextA2pFeeRequired,
  parseMassTextCheckoutKey,
  listMassTextPricingCards,
  formatUsdFromCents,
} from "../src/lib/mass-texting/pricing";
import {
  estimateMessagingCredits,
  MASS_TEXT_MMS_CREDITS_PER_MESSAGE,
} from "../src/lib/mass-texting/credit-units";

assert.equal(MASS_TEXT_MONTHLY_PLANS.starter.monthlyPriceCents, 2499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.growth.monthlyPriceCents, 3499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.pro.monthlyPriceCents, 5499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.business.monthlyPriceCents, 9499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.scale.monthlyPriceCents, 16999);
assert.equal(MASS_TEXT_MONTHLY_PLANS.starter.includedSegments, 500);
assert.equal(MASS_TEXT_MONTHLY_PLANS.growth.includedSegments, 1000);
assert.equal(MASS_TEXT_MONTHLY_PLANS.pro.includedSegments, 2500);
assert.equal(MASS_TEXT_MONTHLY_PLANS.business.includedSegments, 5000);
assert.equal(MASS_TEXT_MONTHLY_PLANS.scale.includedSegments, 10000);

assert.equal(MASS_TEXT_PAYG_PACKS.pack_500.priceCents, 2999);
assert.equal(MASS_TEXT_PAYG_PACKS.pack_1000.priceCents, 3999);
assert.equal(MASS_TEXT_PAYG_PACKS.pack_2500.priceCents, 6499);
assert.equal(MASS_TEXT_PAYG_PACKS.pack_5000.priceCents, 10999);
assert.equal(MASS_TEXT_PAYG_PACKS.pack_10000.priceCents, 18999);
assert.equal(MASS_TEXT_PAYG_LINE.monthlyPriceCents, 1499);
assert.equal(MASS_TEXT_ADDITIONAL_NUMBER.monthlyPriceCents, 799);
assert.equal(MASS_TEXT_MMS_CREDIT_MULTIPLIER, 3);
assert.equal(MASS_TEXT_MMS_PRODUCTION_ENABLED, true);
assert.equal(MASS_TEXT_TRIAL.mmsEnabled, true);
assert.equal(creditsForRenderedMessage({ isMms: false, smsSegments: 1 }), 1);
assert.equal(creditsForRenderedMessage({ isMms: false, smsSegments: 2 }), 2);
assert.equal(creditsForRenderedMessage({ isMms: false, smsSegments: 3 }), 3);
assert.equal(creditsForRenderedMessage({ isMms: true, smsSegments: 1 }), 3);
assert.equal(creditsForRenderedMessage({ isMms: true, smsSegments: 1 }) * 100, 300);

assert.equal(MASS_TEXT_TRIAL.durationDays, 14);
assert.equal(MASS_TEXT_TRIAL.includedSegments, 100);
assert.equal(MASS_TEXT_TRIAL.mmsEnabled, true);
assert.equal(MASS_TEXT_A2P_REGISTRATION_FEE_CENTS, 2000);

assert.equal(MASS_TEXT_MMS_CREDITS_PER_MESSAGE, 3);
assert.equal(
  estimateMessagingCredits({ recipientCount: 100, smsSegmentsPerRecipient: 1, isMms: true }),
  300,
);
assert.equal(
  estimateMessagingCredits({ recipientCount: 10, smsSegmentsPerRecipient: 2, isMms: false }),
  20,
);

assert.equal(
  massTextA2pFeeRequired({ billingModel: "monthly", monthlyTier: "starter", a2pFeeStatus: "PENDING" }),
  true,
);
assert.equal(
  massTextA2pFeeRequired({ billingModel: "monthly", monthlyTier: "pro", a2pFeeStatus: "PENDING" }),
  false,
);
assert.equal(
  massTextA2pFeeRequired({ billingModel: "payg", paygPack: "pack_2500", a2pFeeStatus: "PENDING" }),
  false,
);
assert.equal(
  massTextA2pFeeRequired({ billingModel: "payg", paygPack: "pack_500", a2pFeeStatus: "PAID" }),
  false,
);

assert.deepEqual(parseMassTextCheckoutKey("mass_texting_starter"), {
  kind: "monthly",
  tier: "starter",
});
assert.deepEqual(parseMassTextCheckoutKey("mass_texting_pack_1000"), {
  kind: "payg_pack",
  pack: "pack_1000",
});
assert.deepEqual(parseMassTextCheckoutKey("mass_texting_payg_line"), { kind: "payg_line" });

const cards = listMassTextPricingCards();
assert.equal(cards.monthly.length, 5);
assert.equal(cards.paygPacks.length, 5);
assert.equal(formatUsdFromCents(2499), "$24.99");

console.log("test-mass-texting-pricing-billing: ok");
