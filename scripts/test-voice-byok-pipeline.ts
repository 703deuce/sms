/**
 * Offline tests for BYOK voice pipeline (OpenAI LLM + Deepgram STT + ElevenLabs TTS).
 * Run: npx tsx scripts/test-voice-byok-pipeline.ts
 */
import assert from "node:assert/strict";
import { getVoicePipelineConfig } from "../src/lib/voice/runtime-provider/config";
import { buildAmySttConfig } from "../voice-runtime/src/stt-config";
import {
  usesDeepgramPluginStt,
  usesElevenLabsPluginTts,
  resolveDeepgramSttApi,
} from "../voice-runtime/src/pipeline";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) {
    saved[key] = process.env[key];
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

withEnv(
  {
    VOICE_LLM_PRESET: "gpt-5-nano",
    VOICE_STT_PROVIDER: "deepgram-plugin",
    VOICE_STT_MODEL: "deepgram/flux-general-en",
    VOICE_TTS_PROVIDER: "elevenlabs-plugin",
    VOICE_TTS_MODEL: "eleven_flash_v2_5",
    VOICE_TURN_PRESET: "flux_eager",
  },
  () => {
    const cfg = getVoicePipelineConfig();
    assert.equal(cfg.llmProvider, "openai");
    assert.equal(cfg.llmModel, "gpt-5-nano");
    assert.equal(cfg.sttProvider, "deepgram-plugin");
    assert.equal(cfg.ttsProvider, "elevenlabs-plugin");
    assert.equal(usesDeepgramPluginStt(cfg.sttProvider), true);
    assert.equal(usesElevenLabsPluginTts(cfg.ttsProvider), true);
    assert.equal(resolveDeepgramSttApi(buildAmySttConfig()), "flux_v2");
  },
);

console.log("voice BYOK pipeline tests: PASS");
