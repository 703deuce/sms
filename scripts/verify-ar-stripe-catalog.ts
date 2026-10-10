/**
 * Verifies Appointment Reminders Stripe catalog IDs in code (and optionally against Stripe API).
 *
 * Usage:
 *   npx tsx scripts/verify-ar-stripe-catalog.ts
 *   npx tsx scripts/verify-ar-stripe-catalog.ts --live-stripe   # requires STRIPE_SECRET_KEY
 */
import { AR_PAID_PLAN_KEYS } from "../src/lib/appointment-reminders/commercial/ar-plan-catalog";
import {
  getArStripeCatalog,
  resolveArStripePriceId,
} from "../src/lib/appointment-reminders/commercial/ar-stripe-catalog";
import { stripeBillingMode } from "../src/lib/products/platform-billing-catalog";

async function main() {
  const liveStripe = process.argv.includes("--live-stripe");
  const mode = stripeBillingMode();
  const catalog = getArStripeCatalog();

  console.log(`AR Stripe catalog verify (billing mode: ${mode})`);
  let failed = false;

  for (const plan of AR_PAID_PLAN_KEYS) {
    let priceId: string;
    try {
      priceId = resolveArStripePriceId(plan);
    } catch (err) {
      console.error(`FAIL ${plan}: ${err instanceof Error ? err.message : String(err)}`);
      failed = true;
      continue;
    }
    const productId = catalog.productIds[plan];
    console.log(`OK   ${plan}: product=${productId} price=${priceId}`);

    if (liveStripe) {
      const key = process.env.STRIPE_SECRET_KEY?.trim();
      if (!key) {
        console.error("FAIL live-stripe: STRIPE_SECRET_KEY is not set");
        failed = true;
        continue;
      }
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(key);
      const price = await stripe.prices.retrieve(priceId);
      if (!price.active) {
        console.error(`FAIL ${plan}: Stripe price ${priceId} is not active`);
        failed = true;
      } else if (price.product !== productId) {
        console.error(
          `FAIL ${plan}: price product ${price.product} !== catalog product ${productId}`,
        );
        failed = true;
      } else {
        console.log(`OK   ${plan}: Stripe API confirms active price → product`);
      }
    }
  }

  if (failed) {
    process.exit(1);
  }
  console.log("PASS: Appointment Reminders Stripe catalog resolves for all paid plans.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
