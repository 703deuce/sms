/**
 * OpenAI Realtime media bridge — config, tools, token checks.
 * Run: npx tsx scripts/test-openai-realtime-media-bridge.ts
 */
import assert from "node:assert/strict";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import { applyAmyMinimumSideEffectConfig } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  shouldUseOpenAiRealtimeMediaBridge,
  OPENAI_REALTIME_MINI_MODEL_ID,
} from "../src/lib/voice/telnyx/openai-realtime-bridge/flags";
import { applyOpenAiRealtimeMediaBridgeConfig } from "../src/lib/voice/telnyx/openai-realtime-bridge/apply-bridge-config";
import { buildOpenAiRealtimeVoiceV2Tools } from "../src/lib/voice/telnyx/openai-realtime-bridge/realtime-tools";
import {
  mintRealtimeBridgeStreamToken,
  verifyRealtimeBridgeStreamToken,
} from "../src/lib/voice/telnyx/openai-realtime-bridge/stream-token";
import { VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE } from "../src/lib/voice-v2/telnyx-tool-definition";
import { AMY_MINIMUM_SIDE_EFFECT_MODEL } from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  buildTelnyxMediaStreamUrl,
  getRealtimeBridgePublicWssBase,
  OPENAI_REALTIME_BRIDGE_PUBLIC_WSS_URL,
} from "../src/lib/voice/telnyx/openai-realtime-bridge/config";

process.env.VOICE_REALTIME_BRIDGE_SIGNING_SECRET = "test-bridge-secret";
process.env.APP_URL = "https://app.transovo.ai";

const voiceV2Config = parseVoiceAgentConfig({
  advanced: {
    bookingStrategy: "MICROSOFT_365",
    voiceV2PstnLiveBooking: true,
    conversationWorkflowMode: true,
  },
  voiceLanguage: { voiceId: "ava-warm-us" },
});

assert.equal(shouldUseOpenAiRealtimeMediaBridge(voiceV2Config), true);

const applied = applyAmyMinimumSideEffectConfig(voiceV2Config);
assert.equal(
  (applied.advanced as { voiceTransport?: string })?.voiceTransport,
  "openai_realtime_media_bridge",
);
assert.equal(applied.callHandling?.inboundRoutingMode, "call_control");
assert.equal(applied.model?.modelId, AMY_MINIMUM_SIDE_EFFECT_MODEL);
assert.equal(
  (applied.advanced as { realtimeModel?: string })?.realtimeModel,
  OPENAI_REALTIME_MINI_MODEL_ID,
);

const tools = buildOpenAiRealtimeVoiceV2Tools({ config: applied, transferEnabled: true });
assert.ok(tools.some((t) => t.name === VOICE_V2_FIND_AVAILABILITY_TOOL_TYPE));

const token = mintRealtimeBridgeStreamToken({
  callId: "call_1",
  workspaceId: "ws_1",
  agentId: "agent_1",
  callControlId: "cc_1",
});
const claims = verifyRealtimeBridgeStreamToken(token);
assert.equal(claims?.callId, "call_1");

const bridgeOnly = applyOpenAiRealtimeMediaBridgeConfig(voiceV2Config);
assert.equal(bridgeOnly.callHandling?.inboundRoutingMode, "call_control");

assert.equal(getRealtimeBridgePublicWssBase(), OPENAI_REALTIME_BRIDGE_PUBLIC_WSS_URL);
assert.ok(
  buildTelnyxMediaStreamUrl("tok").startsWith(`${OPENAI_REALTIME_BRIDGE_PUBLIC_WSS_URL}/telnyx/media?token=`),
);

process.env.APP_URL = "http://localhost:3000";
assert.equal(getRealtimeBridgePublicWssBase(), "ws://localhost:3108");

console.log("OK — OpenAI Realtime media bridge checks passed");
