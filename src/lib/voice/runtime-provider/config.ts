import type { VoiceRuntimeProviderId } from "./types";
import {
  isVoiceLlmPresetId,
  resolveVoiceLlmPreset,
  type VoiceLlmPresetId,
} from "./llm-presets";
import {
  resolveVoiceTtsPreset,
  type VoiceTtsPresetId,
  isVoiceTtsPresetId,
} from "./tts-presets";

/** Default to LiveKit for new development; production Amy stays on Telnyx until cutover. */
export function getVoiceRuntimeProviderId(): VoiceRuntimeProviderId {
  const raw = (process.env.VOICE_RUNTIME_PROVIDER || "livekit").trim().toLowerCase();
  if (raw === "telnyx" || raw === "livekit") return raw;
  return "livekit";
}

export function isLiveKitVoiceRuntime(): boolean {
  return getVoiceRuntimeProviderId() === "livekit";
}

export function isTelnyxAssistantVoiceRuntime(): boolean {
  return getVoiceRuntimeProviderId() === "telnyx";
}

/** Normalize LIVEKIT_URL when Coolify stores the SIP host instead of wss:// */
export function normalizeLiveKitApiUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return "";

  if (value.startsWith("sip:")) {
    value = value.slice(4);
  }

  if (!value.includes("://")) {
    if (value.includes(".sip.livekit.cloud")) {
      return `wss://${value.replace(/\.sip\.livekit\.cloud$/, ".livekit.cloud")}`;
    }
    return `wss://${value}`;
  }

  try {
    const parsed = new URL(value);
    if (parsed.hostname.includes(".sip.livekit.cloud")) {
      parsed.hostname = parsed.hostname.replace(/\.sip\.livekit\.cloud$/, ".livekit.cloud");
      if (parsed.protocol === "sip:") parsed.protocol = "wss:";
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    // fall through
  }

  return value;
}

export type VoicePipelineConfig = {
  sttProvider: string;
  sttModel: string;
  sttLanguage: string;
  llmProvider: string;
  llmModel: string;
  llmPreset?: VoiceLlmPresetId;
  ttsProvider: string;
  ttsModel: string;
  ttsLanguage: string;
  ttsVoice?: string;
  ttsPreset?: VoiceTtsPresetId;
};

function resolveTtsFromEnv(): Pick<
  VoicePipelineConfig,
  "ttsProvider" | "ttsModel" | "ttsVoice" | "ttsLanguage" | "ttsPreset"
> {
  const presetRaw = process.env.VOICE_TTS_PRESET?.trim().toLowerCase();
  const preset = isVoiceTtsPresetId(presetRaw) ? resolveVoiceTtsPreset(presetRaw) : null;

  const explicitModel = process.env.VOICE_TTS_MODEL?.trim();
  const explicitProvider = process.env.VOICE_TTS_PROVIDER?.trim();
  const explicitVoice = process.env.VOICE_TTS_VOICE?.trim();

  if (explicitModel || explicitProvider) {
    return {
      ttsProvider: explicitProvider || preset?.provider || "elevenlabs",
      ttsModel: explicitModel || preset?.model || "elevenlabs/eleven_flash_v2_5",
      ttsVoice: explicitVoice || preset?.voice,
      ttsLanguage: process.env.VOICE_TTS_LANGUAGE || preset?.language || "en",
      ttsPreset: preset?.id,
    };
  }

  if (preset) {
    return {
      ttsProvider: preset.provider,
      ttsModel: preset.model,
      ttsVoice: explicitVoice || preset.voice,
      ttsLanguage: process.env.VOICE_TTS_LANGUAGE || preset.language,
      ttsPreset: preset.id,
    };
  }

  return {
    ttsProvider: process.env.VOICE_TTS_PROVIDER || "elevenlabs-plugin",
    ttsModel: process.env.VOICE_TTS_MODEL || "eleven_flash_v2_5",
    ttsLanguage: process.env.VOICE_TTS_LANGUAGE || "en",
    ttsVoice: explicitVoice || process.env.VOICE_TTS_VOICE || "cgSgspJ2msm6clMCkdW9",
    ttsPreset: "elevenlabs",
  };
}

function resolveLlmFromEnv(): Pick<
  VoicePipelineConfig,
  "llmProvider" | "llmModel" | "llmPreset"
> {
  const presetRaw = process.env.VOICE_LLM_PRESET?.trim().toLowerCase();
  const preset = resolveVoiceLlmPreset(presetRaw);

  const explicitModel = process.env.VOICE_LLM_MODEL?.trim();
  const explicitProvider = process.env.VOICE_LLM_PROVIDER?.trim();

  if (explicitModel || explicitProvider) {
    return {
      llmProvider: explicitProvider || preset?.provider || "openai",
      llmModel: explicitModel || preset?.model || "gpt-5-nano",
      llmPreset: preset?.id,
    };
  }

  if (preset) {
    return {
      llmProvider: preset.provider,
      llmModel: preset.model,
      llmPreset: preset.id,
    };
  }

  return {
    llmProvider: "openai",
    llmModel: "gpt-5-nano",
    llmPreset: "gpt-5-nano",
  };
}

/** Voice pipeline — defaults to BYO plugins (OpenAI, Deepgram, ElevenLabs). */
export function getVoicePipelineConfig(): VoicePipelineConfig {
  const tts = resolveTtsFromEnv();
  const llm = resolveLlmFromEnv();
  return {
    sttProvider: process.env.VOICE_STT_PROVIDER || "deepgram-plugin",
    sttModel: process.env.VOICE_STT_MODEL || "deepgram/flux-general-en",
    sttLanguage: process.env.VOICE_STT_LANGUAGE || "en",
    llmProvider: llm.llmProvider,
    llmModel: llm.llmModel,
    llmPreset: llm.llmPreset,
    ttsProvider: tts.ttsProvider,
    ttsModel: tts.ttsModel,
    ttsLanguage: tts.ttsLanguage,
    ttsVoice: tts.ttsVoice,
    ttsPreset: tts.ttsPreset,
  };
}

export function requireLiveKitEnv(): {
  url: string;
  apiKey: string;
  apiSecret: string;
} {
  const rawUrl = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  const url = rawUrl ? normalizeLiveKitApiUrl(rawUrl) : "";
  if (!url || !apiKey || !apiSecret) {
    throw new Error("LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are required");
  }
  return { url, apiKey, apiSecret };
}
