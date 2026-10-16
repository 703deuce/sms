/**
 * Pure routing/dispatch unit checks — no DB.
 * Run: npx tsx scripts/test-voice-v3-inbound-dispatch-routing.ts
 */
import assert from "node:assert/strict";
import {
  VOICE_V3_LIVEKIT_AGENT_NAME,
  buildVoiceV3LiveKitJobMetadataJson,
  isVoiceV3AppointmentReceptionistConfig,
  resolveLiveKitInboundDispatchAgentName,
} from "../src/lib/voice-v3/livekit-inbound-dispatch";
import { TRANSOVO_LIVEKIT_AGENT_NAME } from "../src/lib/telephony/provisioning/config";
import {
  buildLiveKitAgentJobMetadataJson,
  resolveLiveKitDispatchAgentNameFromMetadata,
} from "../src/lib/telephony/provisioning/livekit/dispatch-snapshot-sync";
import { buildExplicitDispatchMetadata } from "../src/lib/telephony/provisioning/dispatch-metadata";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

function receptionistConfig(): VoiceAgentConfig {
  return {
    identity: { displayName: "Amy" },
    advanced: { capabilityPack: "appointment_receptionist" },
  } as VoiceAgentConfig;
}

function legacyConfig(): VoiceAgentConfig {
  return {
    identity: { displayName: "Lab" },
    advanced: { livekitAgentTemplate: "livekit_basic_voice" },
  } as VoiceAgentConfig;
}

assert.equal(isVoiceV3AppointmentReceptionistConfig(receptionistConfig()), true);
assert.equal(isVoiceV3AppointmentReceptionistConfig(legacyConfig()), false);

assert.equal(
  resolveLiveKitInboundDispatchAgentName(receptionistConfig()),
  VOICE_V3_LIVEKIT_AGENT_NAME,
);
assert.equal(
  resolveLiveKitInboundDispatchAgentName(legacyConfig()),
  TRANSOVO_LIVEKIT_AGENT_NAME,
);

const v3Meta = buildExplicitDispatchMetadata({
  workspaceId: "ws_test",
  agentId: "agent_wizard",
  toE164: "+15714073615",
  dispatchSource: "phone_provision",
  livekitDispatchAgentName: VOICE_V3_LIVEKIT_AGENT_NAME,
});
assert.equal(resolveLiveKitDispatchAgentNameFromMetadata(v3Meta), VOICE_V3_LIVEKIT_AGENT_NAME);
const v3Json = buildLiveKitAgentJobMetadataJson(v3Meta);
assert.ok(v3Json.includes("voice_v3_gpt_live"));
assert.ok(v3Json.includes("+15714073615"));
assert.ok(!v3Json.includes("pythonRuntimeBootstrapSnapshot"));

const v3Direct = buildVoiceV3LiveKitJobMetadataJson({
  workspaceId: "ws_test",
  agentId: "agent_wizard",
  toE164: "+15714073615",
});
assert.ok(JSON.parse(v3Direct).runtime === "voice_v3_gpt_live");

console.log("test-voice-v3-inbound-dispatch-routing: PASS");
