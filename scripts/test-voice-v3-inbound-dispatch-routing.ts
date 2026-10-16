/**
 * Pure routing/dispatch unit checks — no DB.
 * Run: npx tsx scripts/test-voice-v3-inbound-dispatch-routing.ts
 */
import assert from "node:assert/strict";
import {
  VOICE_V3_LIVEKIT_AGENT_NAME,
  buildVoiceV3LiveKitJobMetadataJson,
  resolveLiveKitInboundDispatchAgentName,
} from "../src/lib/voice-v3/livekit-inbound-dispatch";
import { TRANSOVO_LIVEKIT_AGENT_NAME } from "../src/lib/telephony/provisioning/config";
import {
  buildLiveKitAgentJobMetadataJson,
  resolveLiveKitDispatchAgentNameFromMetadata,
} from "../src/lib/telephony/provisioning/livekit/dispatch-snapshot-sync";
import { buildExplicitDispatchMetadata } from "../src/lib/telephony/provisioning/dispatch-metadata";
import { normalizeAgentTemplateId } from "../src/lib/voice/templates/agent-template-config";
import type { VoiceAgentConfig } from "../src/lib/voice/types";

assert.equal(TRANSOVO_LIVEKIT_AGENT_NAME, VOICE_V3_LIVEKIT_AGENT_NAME);

function receptionistConfig(): VoiceAgentConfig {
  return {
    identity: { displayName: "Amy" },
    advanced: { capabilityPack: "appointment_receptionist" },
  } as VoiceAgentConfig;
}

assert.equal(
  resolveLiveKitInboundDispatchAgentName(receptionistConfig()),
  VOICE_V3_LIVEKIT_AGENT_NAME,
);
assert.equal(resolveLiveKitInboundDispatchAgentName(null), VOICE_V3_LIVEKIT_AGENT_NAME);

const meta = buildExplicitDispatchMetadata({
  workspaceId: "ws_test",
  agentId: "agent_wizard",
  toE164: "+15714073615",
  dispatchSource: "phone_provision",
  livekitDispatchAgentName: VOICE_V3_LIVEKIT_AGENT_NAME,
});
assert.equal(resolveLiveKitDispatchAgentNameFromMetadata(meta), VOICE_V3_LIVEKIT_AGENT_NAME);
const json = buildLiveKitAgentJobMetadataJson(meta);
assert.ok(json.includes("voice_v3_gpt_live"));
assert.ok(json.includes("+15714073615"));
assert.ok(!json.includes("pythonRuntimeBootstrapSnapshot"));

assert.throws(() => normalizeAgentTemplateId("livekit_basic_voice"));

console.log("test-voice-v3-inbound-dispatch-routing: PASS");
