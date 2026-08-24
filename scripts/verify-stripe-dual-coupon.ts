#!/usr/bin/env npx tsx
import { getStripe } from "../src/lib/stripe/client.ts";
import { dualProductCouponId } from "../src/lib/products/platform-billing-catalog.ts";

async function main() {
  const stripe = getStripe();
  if (!stripe) throw new Error("no stripe");
  const id = dualProductCouponId();
  const c = await stripe.coupons.retrieve(id);
  console.log(JSON.stringify({ id: c.id, percent_off: c.percent_off, valid: c.valid, name: c.name }));
}

main().catch(console.error);
