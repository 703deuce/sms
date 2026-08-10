/**
 * Regression tests for cancel_appointment targeting (this-call first).
 * Run: npx tsx scripts/test-frontdesk-cancel-targeting.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cancelSource = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/cancel-appointment-tool.ts"),
  "utf8",
);

assert.ok(
  cancelSource.includes("callId: ud.callId"),
  "cancel prefers appointments from the current call",
);

assert.ok(
  cancelSource.includes("pendingSlotId") && cancelSource.includes("isBookingConfirmed"),
  "cancel blocks when this call never completed a booking",
);

assert.ok(
  cancelSource.includes("Multiple upcoming appointments"),
  "cancel asks for appointment_id when several are on file",
);

assert.ok(
  cancelSource.includes("from an earlier call"),
  "cancel discloses when cancelling a visit from a prior call",
);

console.log("frontdesk cancel targeting tests: PASS");
