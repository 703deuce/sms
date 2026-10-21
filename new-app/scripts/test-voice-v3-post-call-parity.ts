#!/usr/bin/env npx tsx
/**
 * Post-call parity smoke (no DB): outcome mapping + webhook event types.
 */
import assert from "node:assert/strict";
import { deriveVoiceV3PostCallOutcome } from "@/lib/server/voice-v3/post-call/derive-call-outcome";
import { mapSummaryOutcomeToWebhookType } from "@/lib/server/voice-v3/webhooks/events";

assert.equal(
  deriveVoiceV3PostCallOutcome({ appointmentBooked: true }, null),
  "APPOINTMENT_BOOKED",
);
assert.equal(
  mapSummaryOutcomeToWebhookType("APPOINTMENT_BOOKED"),
  "voice.appointment.booked",
);
assert.equal(
  deriveVoiceV3PostCallOutcome({ callbackRequested: true }, null),
  "CALLBACK_REQUESTED",
);
assert.equal(
  mapSummaryOutcomeToWebhookType("CALLBACK_REQUESTED"),
  "voice.callback.requested",
);
assert.equal(deriveVoiceV3PostCallOutcome({}, "transfer_failed"), "TRANSFER_FAILED");

console.log("test-voice-v3-post-call-parity: ALL PASS");
