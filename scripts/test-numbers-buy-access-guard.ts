/**
 * Business voice customers must reach /numbers/buy without SMS entitlement.
 * Run: npx tsx scripts/test-numbers-buy-access-guard.ts
 */
import assert from "node:assert/strict";
import { productAccessDeniedRedirect } from "../src/lib/products/access-guards";

const voiceOnly = { hasVoice: true, hasSms: false, hasNumbers: false };

assert.equal(
  productAccessDeniedRedirect("/numbers/buy", voiceOnly, { authenticated: true }),
  null,
  "voice business user can open /numbers/buy",
);

assert.equal(
  productAccessDeniedRedirect("/numbers/cmt7test", voiceOnly, { authenticated: true }),
  null,
  "voice business user can open number detail",
);

assert.equal(
  productAccessDeniedRedirect("/numbers", voiceOnly, { authenticated: true }),
  null,
  "voice business user can open numbers list",
);

console.log("test-numbers-buy-access-guard: ok");
