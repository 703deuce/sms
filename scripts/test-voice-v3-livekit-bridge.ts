#!/usr/bin/env npx tsx
/**
 * Voice V3 LiveKit bridge — resolve session + tool execute smoke (no PSTN).
 *
 * NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
 *   npx tsx scripts/test-voice-v3-livekit-bridge.ts
 */
import {
  VOICE_V3_LIVEKIT_INITIAL_TOOL_NAMES,
  commitVoiceV3CallerUtteranceForLiveKit,
  executeVoiceV3ToolForLiveKit,
  resolveVoiceV3LiveKitSession,
} from "../src/lib/voice/python-runtime-bridge/voice-v3-livekit";
import { clearVoiceV3CallRuntimeStore } from "../src/lib/voice-v3/state/call-runtime";
const DIALED = process.env.PHONE_E164?.trim() || "+15717491060";

async function main() {
  clearVoiceV3CallRuntimeStore();

  const room = `lk_test_${Date.now()}`;
  const session = await resolveVoiceV3LiveKitSession({
    roomName: room,
    sipParticipantIdentity: "sip-test-participant",
    callerE164: "+15555550100",
    dialedE164: DIALED,
    sipCallId: "test-sip-call",
    providerCallId: "test-provider-call",
  });

  console.log("RESOLVED_SESSION", {
    liveSessionId: session.liveSessionId,
    toolNames: session.toolNames,
    expectedInitial: VOICE_V3_LIVEKIT_INITIAL_TOOL_NAMES,
    voice: session.liveVoiceId,
    astraModel: session.astraModel,
  });

  if (session.toolNames.length !== VOICE_V3_LIVEKIT_INITIAL_TOOL_NAMES.length) {
    throw new Error(`Expected ${VOICE_V3_LIVEKIT_INITIAL_TOOL_NAMES.length} cert tools`);
  }

  const commit = commitVoiceV3CallerUtteranceForLiveKit({
    liveSessionId: session.liveSessionId,
    utterance: "Monday would work for an appointment.",
  });
  console.log("CALLER_COMMIT", commit);

  const intake = await executeVoiceV3ToolForLiveKit({
    liveSessionId: session.liveSessionId,
    toolName: "update_intake",
    functionCallId: "test_fc_intake_1",
    arguments: { fields: [{ key: "full_name", value: "Test Caller" }] },
  });
  console.log("UPDATE_INTAKE", intake.ok ? "ok" : intake);

  console.log("BRIDGE_SMOKE_PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
