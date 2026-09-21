/**
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' npx tsx scripts/test-voice-v3-call-history.ts
 */
import assert from "node:assert/strict";
import {
  validateNativeCustomerTranscript,
} from "../src/lib/voice-v3/call-history/native-transcript-validator";
import {
  createRecordingAccessToken,
  verifyRecordingAccessToken,
} from "../src/lib/voice/recordings";
import { buildDeterministicSummary } from "../src/lib/voice-v3/call-history/summary";
import { deriveOutcomeBadges } from "../src/lib/voice/calls/display";
import { resolveDualChannelSpeakerMap } from "../src/lib/voice-v3/call-history/channel-semantics";

const overlapMap = resolveDualChannelSpeakerMap({
  channelTexts: [
    { channel: 0, text: "Caller recording channel verification please" },
    { channel: 1, text: "Happy to help you schedule today" },
  ],
  nativeCallerText: "Caller recording channel verification",
  nativeAgentText: "Happy to help you schedule",
  callDirection: "INBOUND",
});
assert.equal(overlapMap.byChannel[0], "caller");
assert.equal(overlapMap.byChannel[1], "agent");
assert.equal(overlapMap.source, "native_overlap");

// Native transcript validator
const good = validateNativeCustomerTranscript({
  segments: [
    { speaker: "caller", text: "Hi, I need an appointment tomorrow.", startMs: 1000, endMs: 3000 },
    { speaker: "agent", text: "Sure, let me check availability.", startMs: 3500, endMs: 6000 },
  ],
  durationSeconds: 120,
  forensicsFinal: true,
});
assert.equal(good.valid, true, "complete native transcript accepted");
assert.equal(good.callerTurns, 1);
assert.equal(good.agentTurns, 1);

const bad = validateNativeCustomerTranscript({
  segments: [{ speaker: "agent", text: "Hello", startMs: 0, endMs: 500 }],
  durationSeconds: 90,
  forensicsFinal: true,
});
assert.equal(bad.valid, false, "missing caller rejected");
assert.ok(bad.reasons.includes("missing_caller_turn"));

const silentCallerLongCall = validateNativeCustomerTranscript({
  segments: [
    { speaker: "caller", text: "I need an appointment.", startMs: 1000, endMs: 3000 },
    { speaker: "agent", text: "Sure, one moment.", startMs: 120000, endMs: 122000 },
  ],
  durationSeconds: 180,
  forensicsFinal: true,
});
assert.equal(
  silentCallerLongCall.valid,
  true,
  "long silence between turns must not reject native transcript",
);
assert.ok(!silentCallerLongCall.reasons.includes("too_sparse_for_duration"));

const withLeak = validateNativeCustomerTranscript({
  segments: [
    { speaker: "caller", text: 'tool_call "book"', startMs: 0, endMs: 500 },
    { speaker: "agent", text: "Ok", startMs: 600, endMs: 1000 },
  ],
  durationSeconds: 10,
  forensicsFinal: true,
});
assert.ok(withLeak.reasons.includes("diagnostic_leak"));

// Recording auth tokens
const { token } = createRecordingAccessToken("rec_1", "ws_1", 120);
const verified = verifyRecordingAccessToken(token);
assert.equal(verified?.recordingId, "rec_1");
assert.equal(verified?.workspaceId, "ws_1");

// Summary deterministic facts
const summary = buildDeterministicSummary("Caller asked about pricing.", {
  callerName: "John",
  appointmentBooked: true,
  appointmentStart: new Date("2026-09-22T10:00:00Z").toISOString(),
  appointmentService: "60 Minute Consultation",
});
assert.match(summary, /Appointment confirmed/i);
assert.match(summary, /60 Minute Consultation/i);

// Outcome badges export
const badges = deriveOutcomeBadges({ appointmentBooked: true });
assert.deepEqual(badges[0], "Appointment Booked");

console.log("test-voice-v3-call-history: ALL PASS");
