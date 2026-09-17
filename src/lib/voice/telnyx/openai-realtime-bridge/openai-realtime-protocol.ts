import { OPENAI_REALTIME_MINI_MODEL_ID } from "./flags";

/**
 * Two OpenAI voice WebSocket protocols (do not mix event names):
 *
 * - **Realtime** `wss://api.openai.com/v1/realtime?model=…` — model from VOICE_REALTIME_MODEL env.
 *   Lifecycle: session.created → session.update → session.updated → input_audio_buffer.append /
 *   response.output_audio.delta.
 *
 * - **Live** `wss://api.openai.com/v1/live/sessions` — model gpt-live-1 (mini is rejected here).
 *   Lifecycle: session.start → session.started → session.input_audio.append /
 *   session.output_audio.delta.
 */
export const OPENAI_REALTIME_API_KIND = "openai_realtime_v1" as const;
export const OPENAI_LIVE_API_KIND = "openai_live_v1" as const;
export const OPENAI_LIVE_WS_URL = "wss://api.openai.com/v1/live/sessions";
export const OPENAI_LIVE_DEFAULT_MODEL = "gpt-live-1";

export const OPENAI_REALTIME_WS_HOST = "api.openai.com";
export const OPENAI_REALTIME_WS_PATH = "/v1/realtime";

export function buildOpenAiRealtimeWebSocketUrl(model?: string): string {
  const m = model?.trim() || OPENAI_REALTIME_MINI_MODEL_ID;
  return `wss://${OPENAI_REALTIME_WS_HOST}${OPENAI_REALTIME_WS_PATH}?model=${encodeURIComponent(m)}`;
}

/** GA Realtime: Bearer only. Do not send OpenAI-Beta (beta shape is rejected). */
export function buildOpenAiRealtimeWebSocketHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

export function summarizeOpenAiServerEvent(ev: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {
    type: ev.type,
    event_id: ev.event_id,
  };
  if (ev.type === "error") {
    const err = (ev.error ?? ev) as Record<string, unknown>;
    summary.error_type = err.type;
    summary.error_code = err.code;
    summary.error_message = err.message;
    summary.error_param = err.param;
  }
  return summary;
}

/** Log-safe client event: keep type and field names; trim huge strings. */
export function summarizeOpenAiClientEvent(ev: Record<string, unknown>): Record<string, unknown> {
  const type = ev.type;
  if (type === "session.update" && ev.session && typeof ev.session === "object") {
    const session = ev.session as Record<string, unknown>;
    return {
      type,
      session: {
        type: session.type,
        output_modalities: session.output_modalities,
        instructions_chars:
          typeof session.instructions === "string" ? session.instructions.length : undefined,
        tools_count: Array.isArray(session.tools) ? session.tools.length : undefined,
        has_audio: Boolean(session.audio),
      },
    };
  }
  if (type === "response.create" && ev.response && typeof ev.response === "object") {
    const response = ev.response as Record<string, unknown>;
    return {
      type,
      response: {
        output_modalities: response.output_modalities,
        instructions_chars:
          typeof response.instructions === "string" ? response.instructions.length : undefined,
      },
    };
  }
  if (type === "input_audio_buffer.append") {
    return { type, audio_b64_chars: typeof ev.audio === "string" ? ev.audio.length : 0 };
  }
  return { type, keys: Object.keys(ev) };
}

export function isOpenAiRealtimeProtocolLoggingEnabled(): boolean {
  return process.env.VOICE_REALTIME_BRIDGE_PROTOCOL_LOG === "1";
}

export function isOpenAiRealtimeMinimalSessionEnabled(): boolean {
  return process.env.VOICE_REALTIME_MINIMAL_SESSION === "1";
}
