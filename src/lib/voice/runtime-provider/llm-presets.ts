/**
 * LiveKit Inference LLM A/B presets for Amy voice comparison.
 * Switch via VOICE_LLM_PRESET or explicit VOICE_LLM_PROVIDER / VOICE_LLM_MODEL.
 */

export const VOICE_LLM_PRESET_IDS = [
  "gpt-5-nano",
  "gemma-4-31b",
  "gpt-4.1-mini",
  "deepseek-v4-flash",
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
  "deepseek-v4-flash": {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash (direct API)",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    notes: "BYO DeepSeek — non-thinking mode by default for voice latency.",
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
  if (usesDeepSeekPluginLlm(provider)) return false;
  return model.includes("/");
}

export function usesDeepSeekPluginLlm(provider: string): boolean {
  const normalized = provider.trim().toLowerCase();
  return normalized === "deepseek" || normalized === "deepseek-plugin";
}

/** Infer BYO provider when only VOICE_LLM_MODEL is set (e.g. deepseek-v4-flash). */
export function inferVoiceLlmProvider(
  provider: string | undefined,
  model: string,
): string {
  const explicit = provider?.trim().toLowerCase();
  if (explicit) {
    if (explicit === "deepseek-plugin") return "deepseek";
    return explicit;
  }
  const normalizedModel = model.trim().toLowerCase();
  if (normalizedModel.startsWith("deepseek-")) return "deepseek";
  return "openai";
}
