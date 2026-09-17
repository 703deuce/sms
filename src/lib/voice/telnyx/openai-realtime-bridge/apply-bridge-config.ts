import type { VoiceAgentConfig } from "@/lib/voice/types";
import { applyLatencyProfileToConfig } from "@/lib/voice/latency-profiles";
import { AMY_FLUX_PROFILE } from "@/lib/voice/telnyx/amy-minimum-side-effect";
import { OPENAI_API_KEY_REF } from "@/lib/voice/telnyx/official-baseline";
import { AMY_MINIMUM_SIDE_EFFECT_MODEL } from "@/lib/voice/telnyx/amy-minimum-side-effect";
import {
  normalizeRealtimeNativeVoice,
  type OpenAiRealtimeNativeVoice,
} from "@/lib/voice/outbound/realtime-native-voices";
import { resolveConfiguredRealtimeVoice } from "@/lib/voice/realtime-voice-picker";
import { OPENAI_REALTIME_MINI_MODEL_ID, OPENAI_REALTIME_BRIDGE_VOICE } from "./public-flags";

/**
 * Wizard/publish config for media-bridge mode.
 * Telnyx AI Assistant is not used on the live audio path; assistant sync may remain for legacy/fallback.
 */
export function applyOpenAiRealtimeMediaBridgeConfig(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  const voice =
    resolveConfiguredRealtimeVoice(config) ?? OPENAI_REALTIME_BRIDGE_VOICE;
  const nativeVoice = normalizeRealtimeNativeVoice(voice, "realtimeVoice");

  const withFlux = applyLatencyProfileToConfig(
    {
      ...config,
      voiceLanguage: {
        ...config.voiceLanguage,
        voiceId: nativeVoice,
        bargeIn: config.voiceLanguage?.bargeIn !== false,
      },
      advanced: {
        ...(config.advanced as object),
        realtimeModel: OPENAI_REALTIME_MINI_MODEL_ID,
        realtimeOutputMode: "native",
        realtimeVoice: nativeVoice,
        voiceTransport: "openai_realtime_media_bridge",
        voiceArchitectureVersion: "telnyx-openai-realtime-bridge-v1",
      },
    },
    AMY_FLUX_PROFILE,
  );

  return {
    ...withFlux,
    callHandling: {
      ...(withFlux.callHandling || {}),
      inboundRoutingMode: "call_control",
    },
    model: {
      ...(withFlux.model || {}),
      provider: "telnyx",
      modelId: AMY_MINIMUM_SIDE_EFFECT_MODEL,
      customApiKeyRef: OPENAI_API_KEY_REF,
      temperature: withFlux.model?.temperature ?? 0.35,
      maxTokens: withFlux.model?.maxTokens ?? 800,
    },
  };
}

export function resolveBridgeRealtimeVoice(config?: VoiceAgentConfig): OpenAiRealtimeNativeVoice {
  const v = resolveConfiguredRealtimeVoice(config) ?? OPENAI_REALTIME_BRIDGE_VOICE;
  return normalizeRealtimeNativeVoice(v, "realtimeVoice");
}
