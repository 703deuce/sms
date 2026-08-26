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
  massTextA2pFeeRequired,
  parseMassTextCheckoutKey,
  listMassTextPricingCards,
  formatUsdFromCents,
} from "../src/lib/mass-texting/pricing";

assert.equal(MASS_TEXT_MONTHLY_PLANS.starter.monthlyPriceCents, 2499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.growth.monthlyPriceCents, 3499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.pro.monthlyPriceCents, 5499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.business.monthlyPriceCents, 9499);
assert.equal(MASS_TEXT_MONTHLY_PLANS.scale.monthlyPriceCents, 16999);

assert.equal(MASS_TEXT_PAYG_PACKS.pack_500.priceCents, 2999);
assert.equal(MASS_TEXT_PAYG_PACKS.pack_1000.priceCents, 3999);
assert.equal(MASS_TEXT_PAYG_PACKS.pack_2500.priceCents, 6499);

assert.equal(MASS_TEXT_TRIAL.durationDays, 14);
assert.equal(MASS_TEXT_TRIAL.includedSegments, 100);
assert.equal(MASS_TEXT_A2P_REGISTRATION_FEE_CENTS, 2000);

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
