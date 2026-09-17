/**
 * Transport-layer checks for Voice V2 Amy → OpenAI Realtime on Telnyx Assistants.
 * Run: npx tsx scripts/test-openai-realtime-telnyx-transport.ts
 */
import assert from "node:assert/strict";
import { parseVoiceAgentConfig } from "../src/lib/voice/types";
import {
  AMY_MINIMUM_SIDE_EFFECT_MODEL,
  applyAmyMinimumSideEffectConfig,
} from "../src/lib/voice/telnyx/amy-minimum-side-effect";
import {
  OPENAI_REALTIME_AMY_VOICE,
  OPENAI_REALTIME_MINI_MODEL_ID,
  TELNYX_OPENAI_REALTIME_MINI_MODEL_ID,
  shouldUseOpenAiRealtimeTelnyxTransport,
} from "../src/lib/voice/telnyx/openai-realtime-telnyx-transport";
import {
  buildFluxTranscriptionSettings,
  isNativeAudioModel,
  OPENAI_REALTIME_GPT_MINI_PROFILE,
} from "../src/lib/voice/latency-profiles";
import { buildAssistantVoiceSettings } from "../src/lib/voice/telnyx/voices";

const voiceV2Config = parseVoiceAgentConfig({
  advanced: {
    bookingStrategy: "MICROSOFT_365",
    voiceV2PstnLiveBooking: true,
    conversationWorkflowMode: true,
  },
  voiceLanguage: { voiceId: "ava-warm-us" },
});

assert.equal(shouldUseOpenAiRealtimeTelnyxTransport(voiceV2Config), true);

const applied = applyAmyMinimumSideEffectConfig(voiceV2Config);
assert.equal(applied.model?.modelId, TELNYX_OPENAI_REALTIME_MINI_MODEL_ID);
assert.equal(applied.transcription?.enabled, false);
assert.equal(isNativeAudioModel(applied.model?.modelId), true);
assert.equal(
  (applied.advanced as { realtimeModel?: string })?.realtimeModel,
  OPENAI_REALTIME_MINI_MODEL_ID,
);
assert.equal(applied.voiceLanguage?.voiceId, OPENAI_REALTIME_AMY_VOICE);

const voiceBuilt = buildAssistantVoiceSettings({ voiceRef: OPENAI_REALTIME_AMY_VOICE });
assert.equal(voiceBuilt.providerVoiceId, "marin");

assert.equal(
  buildFluxTranscriptionSettings(applied),
  undefined,
  "Flux STT settings must not attach to native realtime model",
);

assert.equal(
  OPENAI_REALTIME_GPT_MINI_PROFILE.fields.model?.modelId,
  TELNYX_OPENAI_REALTIME_MINI_MODEL_ID,
);

const legacy = applyAmyMinimumSideEffectConfig(
  parseVoiceAgentConfig({
    advanced: { bookingStrategy: "SEND_LINK", voiceV2PstnLiveBooking: false },
  }),
);
assert.equal(legacy.model?.modelId, AMY_MINIMUM_SIDE_EFFECT_MODEL);
assert.equal(legacy.transcription?.enabled !== false, true);

console.log("OK — OpenAI Realtime Telnyx transport checks passed");
