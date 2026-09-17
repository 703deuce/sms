/**
 * @deprecated Telnyx Assistant native gpt-realtime path — use openai-realtime-bridge instead.
 * Re-exports for scripts/tests migrating to media bridge.
 */
import type { VoiceAgentConfig } from "@/lib/voice/types";
import {
  OPENAI_REALTIME_MINI_MODEL_ID,
  OPENAI_REALTIME_BRIDGE_VOICE as OPENAI_REALTIME_AMY_VOICE,
  shouldUseOpenAiRealtimeMediaBridge,
} from "@/lib/voice/telnyx/openai-realtime-bridge/public-flags";
import { applyOpenAiRealtimeMediaBridgeConfig } from "@/lib/voice/telnyx/openai-realtime-bridge/apply-bridge-config";
import { resolveConfiguredRealtimeVoice } from "@/lib/voice/realtime-voice-picker";
import {
  normalizeRealtimeNativeVoice,
} from "@/lib/voice/outbound/realtime-native-voices";

export {
  OPENAI_REALTIME_MINI_MODEL_ID,
  OPENAI_REALTIME_AMY_VOICE,
  shouldUseOpenAiRealtimeMediaBridge as shouldUseOpenAiRealtimeTelnyxTransport,
};

/** @deprecated Use Telnyx `openai/gpt-realtime-*` only when error 10027 is resolved — prefer media bridge. */
export const TELNYX_OPENAI_REALTIME_MINI_MODEL_ID =
  process.env.VOICE_REALTIME_TELNYX_MODEL?.trim() ||
  `openai/${OPENAI_REALTIME_MINI_MODEL_ID}`;

export const OPENAI_REALTIME_GPT_MINI_LATENCY_PROFILE = "openai_realtime_gpt_21_mini";

export function isOpenAiRealtimeTelnyxModel(model?: string | null): boolean {
  const m = String(model || "").toLowerCase();
  return m.includes("gpt-realtime");
}

export function resolveTelnyxOpenAiRealtimeMiniModelId(): string {
  return TELNYX_OPENAI_REALTIME_MINI_MODEL_ID;
}

export function resolveOpenAiRealtimeMiniModelId(): string {
  return OPENAI_REALTIME_MINI_MODEL_ID;
}

export function applyOpenAiRealtimeTelnyxTransport(
  config: VoiceAgentConfig,
): VoiceAgentConfig {
  return applyOpenAiRealtimeMediaBridgeConfig(config);
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
