/**
 * Unit tests for canonical missed-call detection (no timing heuristics).
 * Run: npx tsx scripts/test-missed-call-detection.ts
 */
import assert from "node:assert/strict";
import { classifyInboundCallOutcome } from "../src/lib/agents/missed-call-text-back/classify";
import { isMissedInboundVoiceCall } from "../src/lib/agents/missed-call-text-back/voice-missed-trigger";

const base = {
  direction: "INBOUND" as const,
  voicemailDetected: false,
  appointmentBooked: false,
};

assert.equal(
  classifyInboundCallOutcome({ direction: "inbound", status: "NO_ANSWER" }),
  "missed_no_answer",
);

assert.equal(
  classifyInboundCallOutcome({
    direction: "inbound",
    status: "COMPLETED",
    answeredAt: null,
  }),
  "missed_no_answer",
);

assert.equal(
  classifyInboundCallOutcome({
    direction: "inbound",
    status: "COMPLETED",
    answeredAt: new Date(),
  }),
  "answered",
);

assert.equal(
  isMissedInboundVoiceCall({ ...base, status: "NO_ANSWER", answeredAt: null }),
  true,
);

assert.equal(
  isMissedInboundVoiceCall({ ...base, status: "COMPLETED", answeredAt: null }),
  true,
);

assert.equal(
  isMissedInboundVoiceCall({
    ...base,
    status: "COMPLETED",
    answeredAt: new Date(),
  }),
  false,
);

assert.equal(
  isMissedInboundVoiceCall({ ...base, status: "RINGING", answeredAt: null }),
  false,
);

console.log("ok missed-call detection");
