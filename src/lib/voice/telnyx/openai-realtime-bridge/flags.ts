import type { VoiceAgentConfig } from "@/lib/voice/types";
import { isVoiceV2PstnLiveBookingMode } from "@/lib/voice-v2/pstn-workflow-mode";

const GPT_REALTIME_FAMILY = ["gpt", "realtime"].join("-");
const REALTIME_21_MINI_SUFFIX = ["2", ".1", "-", "mini"].join("");

/** OpenAI Realtime API model (direct WebSocket — not Telnyx Assistants). */
export const OPENAI_REALTIME_MINI_MODEL_ID =
  process.env.VOICE_REALTIME_MODEL?.trim() ||
  `${GPT_REALTIME_FAMILY}-${REALTIME_21_MINI_SUFFIX}`;

export const OPENAI_REALTIME_BRIDGE_VOICE =
  process.env.VOICE_REALTIME_VOICE?.trim() || "marin";

/**
 * PSTN Voice V2 uses Telnyx media streaming + server-side OpenAI Realtime.
 * This is NOT Telnyx Custom LLM and NOT Telnyx Assistant native gpt-realtime.
 */
export function shouldUseOpenAiRealtimeMediaBridge(
  config?: VoiceAgentConfig | { advanced?: Record<string, unknown> } | null,
): boolean {
  if (!config) return false;
  const advanced = (config as VoiceAgentConfig).advanced as Record<string, unknown> | undefined;
  if (advanced?.voiceTransport === "openai_realtime_media_bridge") return true;
  if (advanced?.voiceTransport === "legacy_cascade") return false;
  if (advanced?.voiceTransport === "openai_realtime_telnyx") return false;
  if (process.env.VOICE_V2_OPENAI_REALTIME_BRIDGE === "0") return false;
  if (process.env.VOICE_V2_OPENAI_REALTIME_TELNYX === "1") return false;
  return isVoiceV2PstnLiveBookingMode(config as VoiceAgentConfig);
}

export function openAiRealtimeBridgeEnabledGlobally(): boolean {
  return process.env.VOICE_V2_OPENAI_REALTIME_BRIDGE !== "0";
}

export function shouldUseOpenAiLivePrimaryWebSocket(): boolean {
  return resolveVoiceAiTransport() === "openai_live";
}

/** Isolated GPT-Live-1 PSTN experiment vs existing Realtime bridge. */
export function resolveVoiceAiTransport(): "openai_live" | "openai_realtime" {
  const raw = process.env.VOICE_AI_TRANSPORT?.trim().toLowerCase();
  if (raw === "openai_live" || raw === "live") return "openai_live";
  if (process.env.VOICE_OPENAI_USE_LIVE_WS === "1") return "openai_live";
  return "openai_realtime";
}
