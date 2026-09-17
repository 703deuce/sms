import crypto from "node:crypto";
import { OPENAI_LIVE_API_KIND, OPENAI_LIVE_WS_URL } from "./openai-realtime-protocol";
import { OPENAI_REALTIME_BRIDGE_VOICE } from "./flags";

/** OpenAI Live primary WebSocket — not /v1/realtime. */
export const OPENAI_LIVE_WEBSOCKET_URL = OPENAI_LIVE_WS_URL;

export const OPENAI_LIVE_MODEL_ID =
  process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1";

export const OPENAI_LIVE_VOICE =
  process.env.OPENAI_LIVE_VOICE?.trim() || OPENAI_REALTIME_BRIDGE_VOICE;

/**
 * Progressive GPT-Live frontend copy (one transport: openai_live).
 * A = protocol baseline (no instructions). B/C add lines when baseline A passes.
 * @see docs/OPENAI-LIVE-PSTN-TEST-PIPELINE.md
 */
export type OpenAiLiveBaseline = "A" | "B" | "C" | "D";

export function resolveOpenAiLiveBaseline(): OpenAiLiveBaseline {
  const raw = (process.env.OPENAI_LIVE_BASELINE || "A").trim().toUpperCase();
  if (raw === "B" || raw === "C" || raw === "D") return raw;
  return "A";
}

/** Baseline D = previous conversational frontend (prompt tuning only after A–C pass). */
const OPENAI_LIVE_BASELINE_D_INSTRUCTIONS = `You are Amy, a warm, professional phone receptionist.

Speak naturally and conversationally.

Keep normal responses very short, usually one sentence.

When you need information from the caller, ask only one question at a time.

After asking a question, stop speaking and wait for the caller to answer.

Respond promptly when the caller finishes speaking. Do not add an unnecessary delay before answering.

A brief natural pause usually means the caller has finished. You do not need to wait several seconds to make sure.

If the caller begins speaking while you are speaking, stop and listen.

Do not fill ordinary silence with comments such as "I'm still here," "take your time," or "whenever you're ready."

Do not repeatedly check whether the caller is still there.

Use the rhythm of a normal telephone conversation: listen, respond briefly, ask one question if needed, then listen again.

This PSTN test bridge has no backend delegation, tools, booking, or business actions wired. Do not claim to schedule appointments or perform account actions.`;

export function buildOpenAiLiveSessionInstructions(
  baseline: OpenAiLiveBaseline,
): string | undefined {
  switch (baseline) {
    case "A":
      return undefined;
    case "B":
      return "You are a helpful phone assistant.";
    case "C":
      return [
        "You are Amy, a helpful phone receptionist.",
        "Keep responses short and ask one question at a time.",
      ].join(" ");
    case "D":
      return OPENAI_LIVE_BASELINE_D_INSTRUCTIONS;
    default:
      return undefined;
  }
}

/** @deprecated Baseline A: caller speaks first — no scripted greeting. */
export const OPENAI_LIVE_GREETING_LINE =
  "Thanks for calling. This is Amy. How can I help you?";

export function buildOpenAiLiveSessionStartPayload(): Record<string, unknown> {
  const baseline = resolveOpenAiLiveBaseline();
  const instructions = buildOpenAiLiveSessionInstructions(baseline);
  const session: Record<string, unknown> = {
    model: OPENAI_LIVE_MODEL_ID,
    audio: {
      format: { type: "audio/pcmu", rate: 8000 },
      output: { voice: OPENAI_LIVE_VOICE },
    },
  };
  if (instructions) {
    session.instructions = instructions;
  }
  return {
    type: "session.start",
    event_id: `live_start_${crypto.randomUUID()}`,
    session,
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
    live_baseline: resolveOpenAiLiveBaseline(),
  };
}

/** @deprecated */
export const OPENAI_LIVE_FRONTEND_INSTRUCTIONS = OPENAI_LIVE_BASELINE_D_INSTRUCTIONS;
export const OPENAI_LIVE_MINIMAL_AMY_INSTRUCTIONS = OPENAI_LIVE_BASELINE_D_INSTRUCTIONS;
