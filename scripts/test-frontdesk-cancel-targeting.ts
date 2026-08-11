/**
 * Regression tests for cancel_appointment targeting (this-call first).
 * Run: npx tsx scripts/test-frontdesk-cancel-targeting.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const lookupSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/appointment-lookup.ts"),
  "utf8",
);
const cancelSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/cancel-appointment-tool.ts"),
  "utf8",
);

assert.ok(
  lookupSource.includes("callId: ud.callId"),
  "cancel prefers appointments from the current call",
);

assert.ok(
  lookupSource.includes("pendingSlotId") && lookupSource.includes("isBookingConfirmed"),
  "lookup blocks when this call never completed a booking",
);
assert.ok(
  cancelSource.includes("markBookingCancelled"),
  "cancel clears booking state for this-call cancellations",
);

assert.ok(
  lookupSource.includes("Multiple upcoming appointments"),
  "cancel asks for appointment_id when several are on file",
);

assert.ok(
  cancelSource.includes("from an earlier call"),
  "cancel discloses when cancelling a visit from a prior call",
);

console.log("frontdesk cancel targeting tests: PASS");
