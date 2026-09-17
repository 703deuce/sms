import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { VoiceAgentConfig } from "@/lib/voice/types";
import { isVoiceV2PstnLiveBookingMode } from "@/lib/voice-v2/pstn-workflow-mode";

function readVoiceAiTransportFile(): string | null {
  const candidates = [
    process.env.VOICE_AI_TRANSPORT_FILE?.trim(),
    join(process.cwd(), ".voice_ai_transport"),
    "/app/.voice_ai_transport",
  ].filter(Boolean) as string[];
  for (const path of candidates) {
    try {
      if (!existsSync(path)) continue;
      const value = readFileSync(path, "utf8").trim().toLowerCase();
      if (value) return value;
    } catch {
      /* try next */
    }
  }
  return null;
}

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

/** GPT-Live PSTN experiment — skip Realtime session init and startup delays. */
export function isGptLivePstnBridgeActive(): boolean {
  return resolveVoiceAiTransport() === "openai_live";
}

/** Realtime GA bridge vs GPT-Live PSTN experiment (`openai_live`). */
export function resolveVoiceAiTransport(): "openai_live" | "openai_realtime" {
  const fromFile = readVoiceAiTransportFile();
  const raw = (process.env.VOICE_AI_TRANSPORT?.trim() || fromFile || "").toLowerCase();
  // Legacy aliases — same live-call-bridge as openai_live (no separate minimal transport).
  if (raw === "openai_live_minimal" || raw === "live_minimal" || raw === "minimal") {
    return "openai_live";
  }
  if (raw === "openai_live" || raw === "live") return "openai_live";
  if (process.env.VOICE_OPENAI_USE_LIVE_WS === "1") return "openai_live";
  return "openai_realtime";
}
