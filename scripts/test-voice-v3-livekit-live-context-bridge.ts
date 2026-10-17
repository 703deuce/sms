#!/usr/bin/env npx tsx
/**
 * LiveKit bridge must return liveContextEvents for Python worker hydration.
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/test-voice-v3-livekit-live-context-bridge.ts
 */
import assert from "node:assert/strict";
import { executeVoiceV3ToolForLiveKit } from "../src/lib/voice/python-runtime-bridge/voice-v3-livekit";
import { resolveVoiceV3DelegatedRuntimeContextForLiveKit } from "../src/lib/voice/python-runtime-bridge/voice-v3-livekit-live-context";
import { createVoiceV3CallRuntime, clearVoiceV3CallRuntimeStore } from "../src/lib/voice-v3/state/call-runtime";
import { VOICE_V3_BOOKING_TEST_CONFIG } from "./voice-v3-booking-test-config";
import { buildVoiceV3CallClock } from "../src/lib/voice-v3/time/call-clock";

async function main() {
  clearVoiceV3CallRuntimeStore();
  const liveSessionId = "lk_live_ctx_unit";
  const clock = buildVoiceV3CallClock("America/New_York");
  createVoiceV3CallRuntime({
    liveSessionId,
    callId: "call_live_ctx_unit",
    config: VOICE_V3_BOOKING_TEST_CONFIG,
    clock,
    inboundCallerE164: "+15555550199",
  });

  const intake = await executeVoiceV3ToolForLiveKit({
    liveSessionId,
    toolName: "update_intake",
    functionCallId: "test_fc_live_ctx",
    arguments: { name: "Golden Era Caller" },
  });

  assert.equal(intake.ok, true, JSON.stringify(intake));
  const events = (intake as { liveContextEvents?: Array<{ type: string; content?: string }> })
    .liveContextEvents;
  assert.ok(Array.isArray(events) && events.length >= 2, "expected thinking + commentary events");
  const thinking = events.find((e) => e.type === "session.thinking.append");
  const commentary = events.find((e) => e.type === "session.commentary.append");
  assert.ok(thinking?.content?.includes("Golden Era Caller"), "thinking must include saved name");
  assert.ok(commentary?.content?.includes("Golden Era Caller"), "commentary must include saved name");

  const delegation = resolveVoiceV3DelegatedRuntimeContextForLiveKit({
    liveSessionId,
    delegationId: "dlg_test_1",
  });
  assert.ok(delegation.liveContextEvents.length >= 2, "delegation hydration must emit context");

  console.log("VOICE_V3_LIVEKIT_LIVE_CONTEXT_BRIDGE_PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
