import type { VoiceRuntimeProviderId } from "./types";

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

export type VoicePipelineConfig = {
  sttProvider: string;
  sttModel: string;
  llmProvider: string;
  llmModel: string;
  ttsProvider: string;
  ttsModel: string;
  ttsVoice?: string;
};

export function getVoicePipelineConfig(): VoicePipelineConfig {
  return {
    sttProvider: process.env.VOICE_STT_PROVIDER || "deepgram",
    sttModel: process.env.VOICE_STT_MODEL || "nova-3",
    llmProvider: process.env.VOICE_LLM_PROVIDER || "openai",
    llmModel: process.env.VOICE_LLM_MODEL || "gpt-4.1-mini",
    ttsProvider: process.env.VOICE_TTS_PROVIDER || "elevenlabs",
    ttsModel: process.env.VOICE_TTS_MODEL || "eleven_flash_v2_5",
    ttsVoice: process.env.VOICE_TTS_VOICE || undefined,
  };
}

export function requireLiveKitEnv(): {
  url: string;
  apiKey: string;
  apiSecret: string;
} {
  const url = process.env.LIVEKIT_URL?.trim();
  const apiKey = process.env.LIVEKIT_API_KEY?.trim();
  const apiSecret = process.env.LIVEKIT_API_SECRET?.trim();
  if (!url || !apiKey || !apiSecret) {
    throw new Error("LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are required");
  }
  return { url, apiKey, apiSecret };
}
