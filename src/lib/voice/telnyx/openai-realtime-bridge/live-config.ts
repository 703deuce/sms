import { OPENAI_LIVE_API_KIND, OPENAI_LIVE_WS_URL } from "./openai-realtime-protocol";
import { OPENAI_REALTIME_BRIDGE_VOICE } from "./flags";

/** OpenAI Live primary WebSocket — not /v1/realtime. */
export const OPENAI_LIVE_WEBSOCKET_URL = OPENAI_LIVE_WS_URL;

export const OPENAI_LIVE_MODEL_ID =
  process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1";

export const OPENAI_LIVE_VOICE =
  process.env.OPENAI_LIVE_VOICE?.trim() || OPENAI_REALTIME_BRIDGE_VOICE;

export const OPENAI_LIVE_MINIMAL_AMY_INSTRUCTIONS = [
  "You are Amy, a professional, warm, natural receptionist.",
  "Answer the caller conversationally.",
  "Keep responses concise and natural.",
  "Allow interruptions.",
  "Do not sound scripted.",
  "For this test, do not perform bookings or business actions.",
  "Simply have a natural conversation with the caller.",
].join(" ");

export const OPENAI_LIVE_GREETING_LINE =
  "Hi, thanks for calling. How can I help you?";

export function buildOpenAiLiveSessionStartPayload(): Record<string, unknown> {
  return {
    type: "session.start",
    event_id: `live_start_${Date.now()}`,
    session: {
      model: OPENAI_LIVE_MODEL_ID,
      instructions: OPENAI_LIVE_MINIMAL_AMY_INSTRUCTIONS,
      audio: {
        format: { type: "audio/pcmu", rate: 8000 },
        output: { voice: OPENAI_LIVE_VOICE },
      },
    },
  };
}

export function liveBridgeMetadata() {
  return {
    api_kind: OPENAI_LIVE_API_KIND,
    endpoint: OPENAI_LIVE_WEBSOCKET_URL,
    model: OPENAI_LIVE_MODEL_ID,
    voice: OPENAI_LIVE_VOICE,
    audio_format: "audio/pcmu@8000",
    pass_through: true,
  };
}
