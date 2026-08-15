/**
 * General booking curveball fixes — email state, scripted speech mode, field validation.
 * Run: npx tsx scripts/test-booking-curveball-fixes.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  persistConfirmedBookingEmail,
  formatBookingEmailSavedFeedback,
} from "../voice-runtime/src/frontdesk/booking-email-state";
import { validateBookingNotesField } from "../voice-runtime/src/frontdesk/booking-field-validation";
import { sessionUsesTtsSay } from "../voice-runtime/src/scripted-speech-output-mode";
import type { FrontDeskUserData } from "../voice-runtime/src/frontdesk/userdata";

const scriptedSpeech = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/outbound/scripted-speech.ts"),
  "utf8",
);
const receptionistTools = fs.readFileSync(
  path.join(process.cwd(), "voice-runtime/src/frontdesk/receptionist/receptionist-tools.ts"),
  "utf8",
);
const workflowRules = fs.readFileSync(
  path.join(process.cwd(), "src/lib/voice/receptionist/build-generated-workflow-rules.ts"),
  "utf8",
);

assert.ok(scriptedSpeech.includes("sessionUsesTtsSay"), "scripted speech resolves mode from session");
assert.ok(!scriptedSpeech.includes("resolveOutboundRealtimeOutputMode()"), "must not use env-only mode");

assert.ok(receptionistTools.includes("persistConfirmedBookingEmail"), "receptionist uses canonical email state");
assert.ok(receptionistTools.includes("validateBookingNotesField"), "receptionist validates weak access notes");
assert.ok(
  receptionistTools.includes("do not also call record_booking_email"),
  "receptionist field tool steers away from duplicate email tool",
);

assert.ok(
  workflowRules.includes("do not also call record_booking_email"),
  "compiled workflow rules document single email path",
);
assert.ok(
  workflowRules.includes("do not call check_booking_status unless"),
  "compiled workflow rules document post-book Q&A",
);

function baseUd(): FrontDeskUserData {
  return {
    workspaceId: "ws",
    agentId: "agent",
    callId: "call",
    businessName: "Test",
    timezone: "America/New_York",
    cal: {} as FrontDeskUserData["cal"],
    slotUnavailableCount: 0,
    receptionistFields: {},
    pendingSlotId: "ST_test",
  };
}

const first = persistConfirmedBookingEmail(baseUd(), "anthony@yahoo.com");
assert.equal(first.ok && first.email, "anthony@yahoo.com");
assert.equal(first.ok && first.unchanged, false);

const ud = baseUd();
persistConfirmedBookingEmail(ud, "anthony@yahoo.com");
const dup = persistConfirmedBookingEmail(ud, "anthony@yahoo.com");
assert.equal(dup.ok && dup.unchanged, true);
assert.match(
  formatBookingEmailSavedFeedback(ud, "record_booking_email", dup),
  /Do NOT call record_booking_email/i,
);

const weak = validateBookingNotesField("custom_access_notes", "None");
assert.equal(weak.ok, false);
const strong = validateBookingNotesField("custom_access_notes", "No gate codes or access notes.");
assert.equal(strong.ok, true);

const mockSession = {
  userData: {
    receptionistCompiled: { realtimeOutputMode: "elevenlabs" },
  },
};
assert.equal(sessionUsesTtsSay(mockSession as never), true);

console.log("test-booking-curveball-fixes: PASS");
