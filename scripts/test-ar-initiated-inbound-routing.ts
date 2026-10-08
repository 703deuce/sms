/**
 * AR-only launch: platform inbound must not enter MCTB when an outbound-initiated AR session exists.
 * Run: NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-ar-initiated-inbound-routing.ts
 */
import assert from "node:assert/strict";
import {
  APPOINTMENT_REMINDERS_V1_PRIMARY,
  isPlatformSharedSmsMctbInboundEnabled,
} from "../src/lib/workspace/platform-launch";

assert.equal(APPOINTMENT_REMINDERS_V1_PRIMARY, true, "AR-only launch");
assert.equal(
  isPlatformSharedSmsMctbInboundEnabled(),
  false,
  "platform 866/Twilio inbound must never fall back to MCTB during AR-only launch",
);

console.log("PASS test-ar-initiated-inbound-routing (launch flags)");
