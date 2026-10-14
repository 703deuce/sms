/**
 * Launch flags: MCTB-primary vs AR-only platform SMS routing posture.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-initiated-inbound-routing.ts
 */
import assert from "node:assert/strict";
import {
  APPOINTMENT_REMINDERS_V1_PRIMARY,
  MCTB_V1_PRIMARY,
  isPlatformSharedSmsMctbInboundEnabled,
} from "../src/lib/workspace/platform-launch";

assert.equal(MCTB_V1_PRIMARY, true, "MCTB-primary launch");
assert.equal(APPOINTMENT_REMINDERS_V1_PRIMARY, false, "AR hidden from primary chrome");
assert.equal(
  isPlatformSharedSmsMctbInboundEnabled(),
  true,
  "platform shared SMS may use MCTB inbound when MCTB is primary",
);

console.log("PASS test-ar-initiated-inbound-routing (launch flags)");
