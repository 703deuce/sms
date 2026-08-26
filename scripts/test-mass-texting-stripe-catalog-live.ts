/**
 * Verify live Stripe prices match canonical Mass Texting pricing.ts.
 * Run: npx tsx scripts/test-mass-texting-stripe-catalog-live.ts
 */
import assert from "node:assert/strict";
import Stripe from "stripe";
import {
  MASS_TEXT_MONTHLY_PLANS,
  MASS_TEXT_PAYG_LINE,
  MASS_TEXT_PAYG_PACKS,
  MASS_TEXT_A2P_REGISTRATION_FEE_CENTS,
  MASS_TEXT_ADDITIONAL_NUMBER,
} from "../src/lib/mass-texting/pricing";
import { MASS_TEXTING_STRIPE_CATALOG_LIVE } from "../src/lib/mass-texting/stripe-catalog-ids-live";

const key = process.env.STRIPE_SECRET_KEY?.trim() || "";
if (!key) {
  console.log("test-mass-texting-stripe-catalog-live: SKIP (no STRIPE_SECRET_KEY)");
  process.exit(0);
}

const stripe = new Stripe(key);

async function expectPrice(id: string, amount: number, recurring?: "month") {
  const price = await stripe.prices.retrieve(id);
  assert.equal(price.unit_amount, amount, `${id} amount`);
  assert.equal(price.currency, "usd", `${id} currency`);
  assert.equal(price.active, true, `${id} active`);
  if (recurring) {
    assert.equal(price.recurring?.interval, recurring, `${id} interval`);
  } else {
    assert.equal(price.recurring, null, `${id} one-time`);
  }
}

async function main() {
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.monthly.starter.stripePriceId, MASS_TEXT_MONTHLY_PLANS.starter.monthlyPriceCents, "month");
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.monthly.growth.stripePriceId, MASS_TEXT_MONTHLY_PLANS.growth.monthlyPriceCents, "month");
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.monthly.pro.stripePriceId, MASS_TEXT_MONTHLY_PLANS.pro.monthlyPriceCents, "month");
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.monthly.business.stripePriceId, MASS_TEXT_MONTHLY_PLANS.business.monthlyPriceCents, "month");
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.monthly.scale.stripePriceId, MASS_TEXT_MONTHLY_PLANS.scale.monthlyPriceCents, "month");
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.payg_line.stripePriceId, MASS_TEXT_PAYG_LINE.monthlyPriceCents, "month");
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.payg_packs.pack_500.stripePriceId, MASS_TEXT_PAYG_PACKS.pack_500.priceCents);
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.payg_packs.pack_1000.stripePriceId, MASS_TEXT_PAYG_PACKS.pack_1000.priceCents);
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.payg_packs.pack_2500.stripePriceId, MASS_TEXT_PAYG_PACKS.pack_2500.priceCents);
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.payg_packs.pack_5000.stripePriceId, MASS_TEXT_PAYG_PACKS.pack_5000.priceCents);
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.payg_packs.pack_10000.stripePriceId, MASS_TEXT_PAYG_PACKS.pack_10000.priceCents);
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.a2p_registration.stripePriceId, MASS_TEXT_A2P_REGISTRATION_FEE_CENTS);
  await expectPrice(MASS_TEXTING_STRIPE_CATALOG_LIVE.additional_number.stripePriceId, MASS_TEXT_ADDITIONAL_NUMBER.monthlyPriceCents, "month");
  console.log("test-mass-texting-stripe-catalog-live: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
