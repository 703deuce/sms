#!/usr/bin/env npx tsx
/**
 * Callback architecture invariants (no PSTN / no keyword routing).
 */
import assert from "node:assert/strict";
import { REQUEST_CALLBACK_TOOL_DESCRIPTION } from "../src/lib/voice-v3/tools/astra-tool-contracts";
import { createInitialVoiceV3CallContext } from "../src/lib/voice-v3/state/call-context";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { mergeIntakeUpdate } from "../src/lib/voice-v3/intake-objective";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";

// Verbal acknowledgment is not authoritative completion.
assert.match(
  REQUEST_CALLBACK_TOOL_DESCRIPTION,
  /Do not tell the caller.*until this tool returns callback_requested/i,
);
assert.match(REQUEST_CALLBACK_TOOL_DESCRIPTION, /conversational reassurance alone does not record/i);

// Facts belong to the call — switching operation does not erase compatible values.
const clock = buildVoiceV3CallClock("America/New_York");
let ctx = createInitialVoiceV3CallContext({
  callId: "inv_facts",
  liveSessionId: "live_inv",
  timezone: "America/New_York",
  clock,
  inboundCallerE164: "+15715550100",
});
const config = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  operationRequirements: {
    book_appointment: ["name", "email"],
    request_callback: ["name", "phone"],
  },
};
const merged = mergeIntakeUpdate({
  current: {},
  update: { name: "Elena", email: "elena@example.com" },
  config,
  at: new Date(),
  sourceCallId: ctx.callId,
  sourceDelegationId: null,
});
ctx = {
  ...ctx,
  intake: { values: merged.values },
  dialog: { activeGoal: "REQUEST_CALLBACK" },
};
assert.equal(ctx.intake.values.name?.value, "Elena");
assert.equal(ctx.intake.values.email?.value, "elena@example.com");

console.log("PASS voice-v3 callback invariants");
