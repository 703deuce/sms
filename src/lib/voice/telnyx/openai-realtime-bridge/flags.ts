import "server-only";

import { existsSync, readFileSync } from "fs";
import { join } from "path";

export {
  OPENAI_REALTIME_MINI_MODEL_ID,
  OPENAI_REALTIME_BRIDGE_VOICE,
  shouldUseOpenAiRealtimeMediaBridge,
  openAiRealtimeBridgeEnabledGlobally,
} from "./public-flags";

function readVoiceAiTransportFile(): string | null {
  const candidates = [
    "/app/.voice_ai_transport",
    process.env.VOICE_AI_TRANSPORT_FILE?.trim(),
    join(process.cwd(), ".voice_ai_transport"),
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

/** GPT-Live PSTN experiment — skip Realtime session init and startup delays. */
export function isGptLivePstnBridgeActive(): boolean {
  return resolveVoiceAiTransport() === "openai_live";
}

export function shouldUseOpenAiLivePrimaryWebSocket(): boolean {
  return resolveVoiceAiTransport() === "openai_live";
}

/** Lean inbound: answer + media stream only (no disclosure, masks, warmup, or telemetry DB). */
export function isGptLivePstnLeanInbound(): boolean {
  return isGptLivePstnBridgeActive();
}

/** Realtime GA bridge vs GPT-Live PSTN experiment (`openai_live`). */
export function resolveVoiceAiTransport(): "openai_live" | "openai_realtime" {
  const fromFile = readVoiceAiTransportFile();
  const raw = (process.env.VOICE_AI_TRANSPORT?.trim() || fromFile || "").toLowerCase();
  if (raw === "openai_live_minimal" || raw === "live_minimal" || raw === "minimal") {
    return "openai_live";
  }
  if (raw === "openai_live" || raw === "live") return "openai_live";
  if (process.env.VOICE_OPENAI_USE_LIVE_WS === "1") return "openai_live";
  return "openai_realtime";
}
