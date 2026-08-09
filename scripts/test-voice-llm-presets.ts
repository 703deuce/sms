/**
 * Offline tests for voice LLM A/B presets (Gemma 4 31B vs GPT-4.1 mini).
 * Run: npx tsx scripts/test-voice-llm-presets.ts
 */
import assert from "node:assert/strict";
import { getVoicePipelineConfig } from "../src/lib/voice/runtime-provider/config";
import {
  usesLiveKitInferenceLlm,
  VOICE_LLM_PRESETS,
} from "../src/lib/voice/runtime-provider/llm-presets";

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

assert.equal(VOICE_LLM_PRESETS["gemma-4-31b"].model, "google/gemma-4-31b-it");
assert.equal(VOICE_LLM_PRESETS["gpt-4.1-mini"].model, "openai/gpt-4.1-mini");

assert.equal(
  usesLiveKitInferenceLlm("inference", "google/gemma-4-31b-it"),
  true,
);
assert.equal(usesLiveKitInferenceLlm("openai", "openai/gpt-4.1-mini"), true);
assert.equal(usesLiveKitInferenceLlm("openai", "gpt-5-nano"), false);

withEnv(
  {
    VOICE_LLM_PRESET: "gemma-4-31b",
    VOICE_LLM_PROVIDER: undefined,
    VOICE_LLM_MODEL: undefined,
  },
  () => {
    const cfg = getVoicePipelineConfig();
    assert.equal(cfg.llmPreset, "gemma-4-31b");
    assert.equal(cfg.llmProvider, "inference");
    assert.equal(cfg.llmModel, "google/gemma-4-31b-it");
    assert.equal(usesLiveKitInferenceLlm(cfg.llmProvider, cfg.llmModel), true);
  },
);

withEnv(
  {
    VOICE_LLM_PRESET: "gpt-4.1-mini",
    VOICE_LLM_PROVIDER: undefined,
    VOICE_LLM_MODEL: undefined,
  },
  () => {
    const cfg = getVoicePipelineConfig();
    assert.equal(cfg.llmPreset, "gpt-4.1-mini");
    assert.equal(cfg.llmProvider, "inference");
    assert.equal(cfg.llmModel, "openai/gpt-4.1-mini");
  },
);

withEnv(
  {
    VOICE_LLM_PRESET: undefined,
    VOICE_LLM_PROVIDER: undefined,
    VOICE_LLM_MODEL: undefined,
  },
  () => {
    const cfg = getVoicePipelineConfig();
    assert.equal(cfg.llmProvider, "openai");
    assert.equal(cfg.llmModel, "gpt-5-nano");
  },
);

console.log("voice LLM preset tests: PASS");
