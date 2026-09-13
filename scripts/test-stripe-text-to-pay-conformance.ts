#!/usr/bin/env tsx
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { STRIPE_TEXT_TO_PAY_CHARGE_MODEL } from "../src/lib/stripe-connect/constants";
import { isCheckoutSessionPaid } from "../src/lib/stripe-connect/constants";

const ROOT = process.cwd();
const TEXT_TO_PAY_PATHS = [
  "src/lib/payment-requests/stripe-checkout.ts",
  "src/lib/stripe-connect/checkout.ts",
];

function walkTs(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === "node_modules" || name === ".git") continue;
    const st = statSync(p);
    if (st.isDirectory()) walkTs(p, out);
    else if (/\.ts$/.test(name)) out.push(p);
  }
  return out;
}

assert.equal(STRIPE_TEXT_TO_PAY_CHARGE_MODEL, "direct");
assert.equal(isCheckoutSessionPaid({ payment_status: "paid" }), true);
assert.equal(isCheckoutSessionPaid({ payment_status: "unpaid" }), false);

const checkoutSrc = readFileSync("src/lib/payment-requests/stripe-checkout.ts", "utf8");
assert.ok(checkoutSrc.includes("createDirectChargeCheckoutSession"));
assert.ok(checkoutSrc.includes("idempotencyKey"));
assert.ok(!checkoutSrc.includes("?paid=1"));

const serviceSrc = readFileSync("src/lib/payment-requests/service.ts", "utf8");
assert.ok(serviceSrc.includes("isCheckoutSessionPaid"));
assert.ok(serviceSrc.includes("payment_processing"));

for (const rel of TEXT_TO_PAY_PATHS) {
  const src = readFileSync(rel, "utf8");
  assert.ok(src.includes("stripeAccount") || src.includes("connectedAccountId"));
}

const bypass: string[] = [];
for (const file of walkTs(path.join(ROOT, "src/lib/payment-requests"))) {
  const rel = file.replace(ROOT + path.sep, "");
  const text = readFileSync(file, "utf8");
  if (text.includes("checkout.sessions.create") && !text.includes("createDirectChargeCheckoutSession")) {
    bypass.push(rel);
  }
}
assert.equal(bypass.length, 0, `payment-requests must use canonical checkout: ${bypass.join(", ")}`);

console.log("test-stripe-text-to-pay-conformance: OK");
