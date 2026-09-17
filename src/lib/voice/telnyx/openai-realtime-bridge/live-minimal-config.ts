import { OPENAI_LIVE_API_KIND, OPENAI_LIVE_WS_URL } from "./openai-realtime-protocol";
import { OPENAI_REALTIME_BRIDGE_VOICE } from "./flags";

export const OPENAI_LIVE_MINIMAL_WS_URL = OPENAI_LIVE_WS_URL;

export const OPENAI_LIVE_MINIMAL_MODEL =
  process.env.OPENAI_LIVE_MODEL?.trim() || "gpt-live-1";

export const OPENAI_LIVE_MINIMAL_VOICE =
  process.env.OPENAI_LIVE_VOICE?.trim() || OPENAI_REALTIME_BRIDGE_VOICE;

/** A = no instructions, B = one-line Amy, C = + short one-question rule */
export type OpenAiLiveMinimalBaseline = "A" | "B" | "C";

export function resolveOpenAiLiveMinimalBaseline(): OpenAiLiveMinimalBaseline {
  const raw = (process.env.OPENAI_LIVE_MINIMAL_BASELINE || "A").trim().toUpperCase();
  if (raw === "B" || raw === "C") return raw;
  return "A";
}

export function buildMinimalLiveInstructions(
  baseline: OpenAiLiveMinimalBaseline,
): string | undefined {
  if (baseline === "A") return undefined;
  if (baseline === "B") return "You are Amy, a helpful phone receptionist.";
  return [
    "You are Amy, a helpful phone receptionist.",
    "Keep responses short and ask one question at a time.",
  ].join(" ");
}

export function buildOpenAiLiveMinimalSessionStartPayload(): Record<string, unknown> {
  const baseline = resolveOpenAiLiveMinimalBaseline();
  const instructions = buildMinimalLiveInstructions(baseline);
  const session: Record<string, unknown> = {
    model: OPENAI_LIVE_MINIMAL_MODEL,
    audio: {
      format: { type: "audio/pcmu", rate: 8000 },
      output: { voice: OPENAI_LIVE_MINIMAL_VOICE },
    },
  };
  if (instructions) {
    session.instructions = instructions;
  }
  return {
    type: "session.start",
    event_id: `live_minimal_start_${Date.now()}`,
    session,
  };
}

export function liveMinimalBridgeMetadata() {
  return {
    api_kind: OPENAI_LIVE_API_KIND,
    endpoint: OPENAI_LIVE_MINIMAL_WS_URL,
    model: OPENAI_LIVE_MINIMAL_MODEL,
    voice: OPENAI_LIVE_MINIMAL_VOICE,
    audio_format: "audio/pcmu@8000",
    baseline: resolveOpenAiLiveMinimalBaseline(),
    protocol: "live_minimal_baseline",
  };
}
