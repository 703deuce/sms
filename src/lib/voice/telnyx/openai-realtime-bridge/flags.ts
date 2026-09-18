import "server-only";

export {
  OPENAI_REALTIME_MINI_MODEL_ID,
  OPENAI_REALTIME_BRIDGE_VOICE,
  shouldUseOpenAiRealtimeMediaBridge,
  openAiRealtimeBridgeEnabledGlobally,
} from "./public-flags";

export function isGptLivePstnBridgeActive(): boolean {
  return false;
}

export function shouldUseOpenAiLivePrimaryWebSocket(): boolean {
  return false;
}

export function isGptLivePstnLeanInbound(): boolean {
  return false;
}

export function resolveVoiceAiTransport(): "openai_live" | "openai_realtime" {
  return "openai_realtime";
}
