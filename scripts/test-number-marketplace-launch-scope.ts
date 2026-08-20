/**
 * Launch-scope + checkout auth helpers for numbers marketplace v1.
 * Run: npx tsx scripts/test-number-marketplace-launch-scope.ts
 */

import assert from "node:assert/strict";
import {
  makeGoogleAuthState,
  parseGoogleAuthState,
  sanitizeNextPath,
} from "../src/lib/auth/google-oauth";
import {
  HIDE_PORT_IN_AT_LAUNCH,
  HIDE_SMS_MARKETING_AT_LAUNCH,
  NUMBERS_PLATFORM_ONLY,
} from "../src/lib/workspace/platform-launch";

function main() {
  assert.equal(NUMBERS_PLATFORM_ONLY, true);
  assert.equal(HIDE_SMS_MARKETING_AT_LAUNCH, true);
  assert.equal(HIDE_PORT_IN_AT_LAUNCH, true);

  assert.equal(sanitizeNextPath("/personal/numbers/premium?reservation=abc"), "/personal/numbers/premium?reservation=abc");
  assert.equal(sanitizeNextPath("https://evil.com"), "/personal");
  assert.equal(sanitizeNextPath("//evil.com"), "/personal");

  const next = "/personal/numbers/premium?reservation=res_123";
  const state = makeGoogleAuthState({ nextPath: next, reservationId: "res_123" });
  const parsed = parseGoogleAuthState(state);
  assert.ok(parsed);
  assert.equal(parsed!.nextPath, next);
  assert.equal(parsed!.reservationId, "res_123");

  console.log("number marketplace launch scope: ok");
}

main();
