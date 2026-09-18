import "server-only";

/** Legacy GPT-Live / Realtime media bridge — removed; Voice V3 Basic uses OpenAI SIP incoming only. */
export const OPENAI_REALTIME_MINI_MODEL_ID = "gpt-realtime";
export const OPENAI_REALTIME_BRIDGE_VOICE = "marin";

export function shouldUseOpenAiRealtimeMediaBridge(_config?: unknown): boolean {
  return false;
}

export function openAiRealtimeBridgeEnabledGlobally(): boolean {
  return false;
}
