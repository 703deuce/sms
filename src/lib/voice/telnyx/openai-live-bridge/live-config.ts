import crypto from "node:crypto";
import {
  OPENAI_LIVE_API_KIND,
  OPENAI_LIVE_WS_URL,
} from "../openai-realtime-bridge/openai-realtime-protocol";
import { OPENAI_REALTIME_BRIDGE_VOICE } from "../openai-realtime-bridge/public-flags";
import { buildLiveSessionConfig } from "./build-live-session-config";
import { isOpenAiLiveDelegationEnabled, isOpenAiLiveSplitPromptsEnabled } from "./constants";

export const OPENAI_LIVE_WEBSOCKET_URL = OPENAI_LIVE_WS_URL;

export const OPENAI_LIVE_MODEL_ID =
  process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1";

export const OPENAI_LIVE_VOICE =
  process.env.OPENAI_LIVE_VOICE?.trim() || OPENAI_REALTIME_BRIDGE_VOICE;

export type OpenAiLiveBaseline = "A" | "B" | "C" | "D" | "G";

export function resolveOpenAiLiveBaseline(): OpenAiLiveBaseline {
  const raw = (process.env.OPENAI_LIVE_BASELINE || "G").trim().toUpperCase();
  if (raw === "A" || raw === "B" || raw === "C" || raw === "D" || raw === "G") return raw;
  return "G";
}

export function resolveOpenAiLiveGreetingLine(): string {
  const custom = process.env.OPENAI_LIVE_GREETING_LINE?.trim();
  if (custom) return custom;
  return "Thanks for calling. This is Amy. How can I help you?";
}

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

Use the rhythm of a normal telephone conversation: listen, respond briefly, ask one question if needed, then listen again.`;

/** Legacy baseline copy when OPENAI_LIVE_SPLIT_PROMPTS=0. */
const OPENAI_LIVE_LEGACY_BASELINE_G = `You are Amy, a warm, professional, natural phone receptionist.`;

export function buildOpenAiLiveSessionInstructions(
  baseline: OpenAiLiveBaseline,
): string | undefined {
  switch (baseline) {
    case "A":
      return undefined;
    case "B":
      return "You are a helpful phone assistant.";
    case "G":
      return OPENAI_LIVE_LEGACY_BASELINE_G;
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

export function buildOpenAiLiveSessionStartPayload(
  sessionOverrides?: Record<string, unknown>,
): Record<string, unknown> {
  const baseline = resolveOpenAiLiveBaseline();

  if (isOpenAiLiveSplitPromptsEnabled() && baseline === "G") {
    const session = {
      ...buildLiveSessionConfig(),
      ...sessionOverrides,
    };
    return {
      type: "session.start",
      event_id: `live_start_${crypto.randomUUID()}`,
      session,
    };
  }

  const instructions = buildOpenAiLiveSessionInstructions(baseline);
  const session: Record<string, unknown> = {
    model: OPENAI_LIVE_MODEL_ID,
    audio: {
      format: { type: "audio/pcmu", rate: 8000 },
      output: { voice: OPENAI_LIVE_VOICE },
    },
    ...sessionOverrides,
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
    pass_through: !isOpenAiLiveDelegationEnabled(),
    live_baseline: resolveOpenAiLiveBaseline(),
    live_greeting_line: resolveOpenAiLiveGreetingLine(),
    live_split_prompts: isOpenAiLiveSplitPromptsEnabled(),
    live_delegation: isOpenAiLiveDelegationEnabled(),
    bridge_package: "openai-live-bridge",
  };
}
