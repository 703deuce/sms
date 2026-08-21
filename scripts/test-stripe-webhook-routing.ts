import assert from "node:assert/strict";
import {
  isPremiumNumberCheckoutMetadata,
} from "../src/lib/payments/stripe-number-purchase-webhook.ts";
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

ok("premium_number metadata recognized", () => {
  assert.equal(isPremiumNumberCheckoutMetadata({ type: "premium_number" }), true);
  assert.equal(isPremiumNumberCheckoutMetadata({ type: "number_purchase" }), true);
  assert.equal(isPremiumNumberCheckoutMetadata({ type: "credits" }), false);
  assert.equal(isPremiumNumberCheckoutMetadata({ type: "subscription" }), false);
});

ok("stripe webhook event list includes billing + marketplace", () => {
  const events = [...STRIPE_WEBHOOK_EVENT_TYPES];
  for (const required of [
    "checkout.session.completed",
    "customer.subscription.updated",
    "invoice.paid",
    "invoice.payment_failed",
    "payment_intent.payment_failed",
  ]) {
    assert.ok(events.includes(required as (typeof events)[number]), `missing ${required}`);
  }
  assert.equal(events.length, 11);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("stripe webhook routing tests passed");
