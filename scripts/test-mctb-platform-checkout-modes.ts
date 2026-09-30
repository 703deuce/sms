/**
 * Static contract: MCTB commercial SKUs use subscription checkout except bundled one-time A2P on own sender.
 * Run: npx tsx scripts/test-mctb-platform-checkout-modes.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const subs = readFileSync(
  join(process.cwd(), "src/lib/products/platform-subscriptions.ts"),
  "utf8",
);

assert.match(subs, /mode:\s*"subscription"/);
assert.match(subs, /input\.productKey === "mctb_own_sender"/);
assert.match(subs, /stripeOneTimePriceId/);

const catalog = readFileSync(
  join(process.cwd(), "src/lib/products/platform-billing-catalog-sync.ts"),
  "utf8",
);
assert.match(catalog, /ensureMonthlyPrice/);
assert.match(catalog, /ensureOneTimePrice/);
assert.match(catalog, /MCTB_OWN_SENDER_A2P_REGISTRATION_CENTS/);

console.log("test-mctb-platform-checkout-modes: ok");
