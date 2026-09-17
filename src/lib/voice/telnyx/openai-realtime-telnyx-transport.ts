import type { VoiceAgentConfig } from "@/lib/voice/types";
import { OPENAI_API_KEY_REF } from "@/lib/voice/telnyx/official-baseline";
import { applyLatencyProfileToConfig } from "@/lib/voice/latency-profiles";
import { isVoiceV2PstnLiveBookingMode } from "@/lib/voice-v2/pstn-workflow-mode";
import {
  normalizeRealtimeNativeVoice,
  type OpenAiRealtimeNativeVoice,
} from "@/lib/voice/outbound/realtime-native-voices";
import { resolveConfiguredRealtimeVoice } from "@/lib/voice/realtime-voice-picker";

const GPT_REALTIME_FAMILY = ["gpt", "realtime"].join("-");
const REALTIME_21_MINI_SUFFIX = ["2", ".1", "-", "mini"].join("");

/** OpenAI Realtime API model id (LiveKit / direct OpenAI). Override: VOICE_REALTIME_MODEL. */
export const OPENAI_REALTIME_MINI_MODEL_ID =
  process.env.VOICE_REALTIME_MODEL?.trim() ||
  `${GPT_REALTIME_FAMILY}-${REALTIME_21_MINI_SUFFIX}`;

/** Telnyx AI Assistants `model` field. Override: VOICE_REALTIME_TELNYX_MODEL. */
export const TELNYX_OPENAI_REALTIME_MINI_MODEL_ID =
  process.env.VOICE_REALTIME_TELNYX_MODEL?.trim() ||
  `openai/${OPENAI_REALTIME_MINI_MODEL_ID}`;

export const OPENAI_REALTIME_AMY_VOICE: OpenAiRealtimeNativeVoice = "marin";

export const OPENAI_REALTIME_GPT_MINI_LATENCY_PROFILE = "openai_realtime_gpt_21_mini";

export function isOpenAiRealtimeTelnyxModel(model?: string | null): boolean {
  const m = String(model || "").toLowerCase();
  return (
    m.includes("gpt-realtime") ||
    m === OPENAI_REALTIME_MINI_MODEL_ID.toLowerCase() ||
    m === TELNYX_OPENAI_REALTIME_MINI_MODEL_ID.toLowerCase()
  );
}

export function resolveTelnyxOpenAiRealtimeMiniModelId(): string {
  return TELNYX_OPENAI_REALTIME_MINI_MODEL_ID;
}

export function resolveOpenAiRealtimeMiniModelId(): string {
  return OPENAI_REALTIME_MINI_MODEL_ID;
}

export function shouldUseOpenAiRealtimeTelnyxTransport(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  if (!config) return false;
  const advanced = (config as VoiceAgentConfig).advanced as Record<string, unknown> | undefined;
  if (advanced?.voiceTransport === "openai_realtime_telnyx") return true;
  if (advanced?.voiceTransport === "legacy_cascade") return false;
  if (process.env.VOICE_V2_OPENAI_REALTIME_TELNYX === "0") return false;
  return isVoiceV2PstnLiveBookingMode(config as VoiceAgentConfig);
}

/**
 * Transport-only: OpenAI Realtime mini on Telnyx Assistants (native audio in/out).
 * Does not change prompts, tools, or booking pipelines.
 */
export function applyOpenAiRealtimeTelnyxTransport(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  const voice =
    resolveConfiguredRealtimeVoice(config) ?? OPENAI_REALTIME_AMY_VOICE;
  const nativeVoice = normalizeRealtimeNativeVoice(voice, "realtimeVoice");
  const telnyxModel = resolveTelnyxOpenAiRealtimeMiniModelId();
  const openAiModel = resolveOpenAiRealtimeMiniModelId();

  const withProfile = applyLatencyProfileToConfig(
    {
      ...config,
      voiceLanguage: {
        ...config.voiceLanguage,
        voiceId: nativeVoice,
        bargeIn: config.voiceLanguage?.bargeIn !== false,
      },
      advanced: {
        ...(config.advanced as object),
        realtimeModel: openAiModel,
        realtimeOutputMode: "native",
        realtimeVoice: nativeVoice,
        voiceTransport: "openai_realtime_telnyx",
        voiceArchitectureVersion: "telnyx-openai-realtime-v1",
      },
    },
    OPENAI_REALTIME_GPT_MINI_LATENCY_PROFILE,
  );

  return {
    ...withProfile,
    model: {
      ...(withProfile.model || {}),
      provider: "telnyx",
      modelId: telnyxModel,
      customApiKeyRef: OPENAI_API_KEY_REF,
      temperature: withProfile.model?.temperature ?? 0.35,
      maxTokens: withProfile.model?.maxTokens ?? 800,
    },
  };
}

export function resolveCompiledRealtimeModel(raw: string | undefined): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed || trimmed === "[REDACTED]") {
    return resolveOpenAiRealtimeMiniModelId();
  }
  if (trimmed === "gpt-realtime-2.1") return "gpt-realtime-2.1";
  if (trimmed === resolveOpenAiRealtimeMiniModelId()) return trimmed;
  if (isOpenAiRealtimeTelnyxModel(trimmed)) {
    return trimmed.includes("/") ? trimmed.split("/").pop()! : trimmed;
  }
  return resolveOpenAiRealtimeMiniModelId();
}
