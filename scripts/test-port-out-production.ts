/**
 * Port-out production tests (hermetic + policy).
 * Run: npx tsx scripts/test-port-out-production.ts
 */
import assert from "node:assert/strict";
import {
  PORTABILITY_GUARANTEE_DAYS,
  isCorrectableRejection,
  isPortabilityReviewRejection,
  rejectionCategoryCustomerMessage,
} from "../src/lib/numbers/port-out-constants";
import { computeGuaranteeEligibility } from "../src/lib/numbers/port-out-service";
import { getDestinationRule } from "../src/lib/numbers/port-out-destination-rules";

function guarantee(input: { purchasedAt: Date; initiatedAt: Date; destinationType: string }) {
  return computeGuaranteeEligibility(input);
}

const purchased = new Date("2026-01-01T12:00:00Z");
const day29 = new Date("2026-01-30T12:00:00Z");
const day31 = new Date("2026-02-02T12:00:00Z");

assert.equal(guarantee({ purchasedAt: purchased, initiatedAt: day29, destinationType: "verizon" }), true);
assert.equal(guarantee({ purchasedAt: purchased, initiatedAt: day31, destinationType: "verizon" }), false);
assert.equal(
  guarantee({ purchasedAt: purchased, initiatedAt: day29, destinationType: "google_voice_personal" }),
  false,
);

assert.equal(isCorrectableRejection("PIN_MISMATCH"), true);
assert.equal(isPortabilityReviewRejection("RATE_CENTER_UNSUPPORTED"), true);
assert.equal(
  rejectionCategoryCustomerMessage("PIN_MISMATCH").toLowerCase().includes("pin"),
  true,
);

const cricket = getDestinationRule("cricket");
assert.ok(cricket?.warningMessage?.includes("Cricket"));
const gv = getDestinationRule("google_voice_personal");
assert.ok(gv?.intermediaryRequired);

assert.equal(PORTABILITY_GUARANTEE_DAYS, 30);

console.log("test-port-out-production: ok");
