/**
 * Phone partial-capture and activeField-only collection tests.
 * Run: npx tsx scripts/test-phone-field-capture.ts
 */
import assert from "node:assert/strict";
import {
  captureUsPhoneDigits,
  extractPhoneDigits,
} from "../src/lib/voice/receptionist/field-validation";

assert.equal(extractPhoneDigits("571..."), "571");

const partial = captureUsPhoneDigits("571");
assert.equal(partial.status, "incomplete");
if (partial.status === "incomplete") {
  assert.equal(partial.digits, "571");
}

const merged = captureUsPhoneDigits("477-6175", "571");
assert.equal(merged.status, "complete");
if (merged.status === "complete") {
  assert.equal(merged.normalized, "+15714776175");
}

const complete = captureUsPhoneDigits("571-477-6175");
assert.equal(complete.status, "complete");
if (complete.status === "complete") {
  assert.equal(complete.normalized, "+15714776175");
}

console.log("✓ phone field capture tests passed");
