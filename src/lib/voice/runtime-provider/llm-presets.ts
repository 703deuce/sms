/**
 * LiveKit Inference LLM A/B presets for Amy voice comparison.
 * Switch via VOICE_LLM_PRESET or explicit VOICE_LLM_PROVIDER / VOICE_LLM_MODEL.
 */

export const VOICE_LLM_PRESET_IDS = [
  "gpt-5-nano",
  "gemma-4-31b",
  "gpt-4.1-mini",
] as const;

export type VoiceLlmPresetId = (typeof VOICE_LLM_PRESET_IDS)[number];

export type VoiceLlmPreset = {
  id: VoiceLlmPresetId;
  label: string;
  provider: string;
  model: string;
  notes: string;
};

export const VOICE_LLM_PRESETS: Record<VoiceLlmPresetId, VoiceLlmPreset> = {
  "gpt-5-nano": {
    id: "gpt-5-nano",
    label: "OpenAI GPT-5 nano (direct API)",
    provider: "openai",
    model: "gpt-5-nano",
    notes: "Default — OpenAI plugin, not LiveKit Inference.",
  },
  "gemma-4-31b": {
    id: "gemma-4-31b",
    label: "Gemma 4 31B (LiveKit Inference)",
    provider: "inference",
    model: "google/gemma-4-31b-it",
    notes: "Latency-optimized open-weight model on LiveKit Inference.",
  },
  "gpt-4.1-mini": {
    id: "gpt-4.1-mini",
    label: "OpenAI GPT-4.1 mini (direct API)",
    provider: "openai",
    model: "gpt-4.1-mini",
    notes: "Production default — OpenAI plugin, not LiveKit Inference.",
  },
};

export function isVoiceLlmPresetId(value: unknown): value is VoiceLlmPresetId {
  return (
    typeof value === "string" &&
    (VOICE_LLM_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function resolveVoiceLlmPreset(id?: string | null): VoiceLlmPreset | null {
  if (isVoiceLlmPresetId(id)) return VOICE_LLM_PRESETS[id];
  return null;
}

/** Inference model IDs use provider/model; direct OpenAI plugin uses bare names. */
export function usesLiveKitInferenceLlm(provider: string, model: string): boolean {
  if (provider === "inference") return true;
  if (provider === "openai" && !model.includes("/")) return false;
  return model.includes("/");
}
