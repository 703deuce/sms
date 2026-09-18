/**
 * Regression: prefer_callback must not override active booking intent.
 */
import assert from "node:assert/strict";

import { transitionAfterIntakeSave } from "@/lib/voice-receptionist-wizard/booking-workflow";
import { defaultVoiceV2BookingWorkflow } from "@/lib/voice-receptionist-wizard/booking-workflow";
import { getIntakeReadiness } from "@/lib/voice-receptionist-wizard/intake/readiness";
import type { VoiceV2CallContext } from "@/lib/voice-receptionist-wizard/intake/types";
import { defaultVoiceV2DialogState } from "@/lib/voice-receptionist-wizard/dialog-goal";

function ctx(): VoiceV2CallContext {
  return {
    sessionKey: "cc:test",
    workspaceId: "ws",
    agentId: "agent",
    businessTimezone: "America/New_York",
    intakeSchema: { fields: [] },
    intakeState: { name: { value: "Anthony", status: "CAPTURED", source: "CALLER", updatedAt: "" } },
    askedFields: {},
    compiledAt: new Date().toISOString(),
    capabilities: { voiceV2PstnLiveBooking: true, bookingStrategy: "MICROSOFT_365" },
    bookingWorkflow: {
      ...defaultVoiceV2BookingWorkflow(),
      bookingIntentActive: true,
      requestedDate: "2026-09-25",
    },
    dialog: defaultVoiceV2DialogState(),
  };
}

const c = ctx();
const readiness = getIntakeReadiness(c.intakeSchema, c.intakeState);
const next = transitionAfterIntakeSave({
  ctx: c,
  raw: { workflow_signal: "prefer_callback" },
  savedKeys: [],
  readiness,
  voiceV2PstnLiveBooking: true,
  bookingStrategy: "MICROSOFT_365",
});

assert.notEqual(next.bookingWorkflow?.nextStage, "CALLBACK_REQUESTED");
assert.equal(next.bookingWorkflow?.callbackRequested, false);
console.log("PASS booking intent precedence", next.bookingWorkflow?.nextStage);

const c2 = ctx();
c2.dialog = { activeGoal: "BOOK_APPOINTMENT", explicitCallbackRequested: false };
c2.bookingWorkflow = {
  ...defaultVoiceV2BookingWorkflow(),
  bookingIntentActive: true,
};
const nextCancel = transitionAfterIntakeSave({
  ctx: c2,
  raw: { workflow_signal: "cancel_booking", name: "Anthony" },
  savedKeys: ["name"],
  readiness: getIntakeReadiness(c2.intakeSchema, c2.intakeState),
  voiceV2PstnLiveBooking: true,
  bookingStrategy: "MICROSOFT_365",
});
assert.equal(nextCancel.bookingWorkflow?.bookingCancelled, false);
assert.notEqual(nextCancel.bookingWorkflow?.nextStage, "COMPLETE");
console.log("PASS legacy cancel_booking ignored on intake save", nextCancel.bookingWorkflow?.nextStage);
