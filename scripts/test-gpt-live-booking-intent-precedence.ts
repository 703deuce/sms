/**
 * Regression: prefer_callback must not override active booking intent.
 */
import assert from "node:assert/strict";

import { transitionAfterIntakeSave } from "@/lib/voice-v2/booking-workflow";
import { defaultVoiceV2BookingWorkflow } from "@/lib/voice-v2/booking-workflow";
import { getIntakeReadiness } from "@/lib/voice-v2/intake/readiness";
import type { VoiceV2CallContext } from "@/lib/voice-v2/intake/types";
import { defaultVoiceV2DialogState } from "@/lib/voice-v2/dialog-goal";

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
