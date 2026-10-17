#!/usr/bin/env npx tsx
/**
 * Ensures each delegation receives authoritative runtime (intake values + goal).
 */
import assert from "node:assert/strict";
import { pushDelegatedRuntimeContextToLive } from "../src/lib/voice-v3/delegation/push-delegated-runtime-context";
import { createVoiceV3CallRuntime } from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";
import { mergeIntakeUpdate } from "../src/lib/voice-v3/intake-objective";

const TZ = "America/New_York";
const clock = buildVoiceV3CallClock(TZ);
const config = {
  ...VOICE_V3_BOOKING_TEST_CONFIG,
  callHandling: {
    ...VOICE_V3_BOOKING_TEST_CONFIG.callHandling,
    callbackRequestsEnabled: true,
  },
};

const runtime = createVoiceV3CallRuntime({
  liveSessionId: "live_hydration_test",
  callId: "call_hydration_test",
  config,
  clock,
  inboundCallerE164: "+15715550100",
});

const merged = mergeIntakeUpdate({
  current: runtime.getSnapshot().intake.values,
  update: { name: "Anthony Johnson", service_reason: "Lights above mirror" },
  config,
  at: new Date(),
  sourceCallId: "call_hydration_test",
  sourceDelegationId: null,
});
runtime.replaceContext({
  ...runtime.getSnapshot(),
  intake: { values: merged.values },
  dialog: { activeGoal: "REQUEST_CALLBACK" },
});

const events: Array<{ type: string; content?: string }> = [];
pushDelegatedRuntimeContextToLive({
  liveSessionId: "live_hydration_test",
  delegationId: "item_test_delegation",
  send: (ev) => {
    events.push(ev as { type: string; content?: string });
  },
});

assert.ok(events.length >= 2, "expected thinking + commentary");
const thinking = events.find((e) => e.type === "session.thinking.append");
const commentary = events.find((e) => e.type === "session.commentary.append");
assert.ok(thinking?.content?.includes("Anthony Johnson"), "thinking must include saved name");
assert.ok(thinking?.content?.includes("REQUEST_CALLBACK"), "thinking must include active goal");
assert.ok(commentary?.content?.includes("Anthony Johnson"), "commentary must include saved name");

console.log("PASS voice-v3 delegation runtime hydration");
