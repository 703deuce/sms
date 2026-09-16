import type { PostCallFrictionLlmResult } from "./friction";
import type { VoiceV2FrictionSignalType } from "./types";

/** Transcript-only friction hints — telemetry only; does not gate transfers/booking. */
export function classifyPostCallFrictionFromTranscript(
  transcriptText: string,
): PostCallFrictionLlmResult {
  const lower = transcriptText.toLowerCase();
  const frictionSignals: PostCallFrictionLlmResult["frictionSignals"] = [];

  if (
    /\b(frustrated|annoyed|ridiculous|useless|terrible service|this is stupid)\b/.test(
      lower,
    )
  ) {
    frictionSignals.push({
      type: "FRUSTRATION",
      confidence: 0.72,
      severity: "medium",
      evidence: "Caller language suggests frustration",
    });
  }
  if (
    /\b(i already (said|told)|you keep asking|how many times|i just said)\b/.test(
      lower,
    )
  ) {
    frictionSignals.push({
      type: "REPEATED_MISUNDERSTANDING",
      confidence: 0.78,
      severity: "medium",
      evidence: "Repeated clarification pattern in transcript",
    });
  }
  if (/\b(wait(ing)? forever|taking too long|still there)\b/.test(lower)) {
    frictionSignals.push({
      type: "TOOL_WAIT_FRICTION",
      confidence: 0.65,
      severity: "low",
      evidence: "Wait-time complaint in transcript",
    });
  }

  return { frictionSignals };
}

export function flattenTranscriptForFriction(
  transcript: unknown,
): string {
  if (!transcript || typeof transcript !== "object") return "";
  const t = transcript as {
    turns?: Array<{ role?: string; text?: string }>;
    segments?: Array<{ text?: string }>;
    text?: string;
  };
  if (typeof t.text === "string") return t.text;
  if (Array.isArray(t.turns)) {
    return t.turns.map((row) => row.text || "").filter(Boolean).join("\n");
  }
  if (Array.isArray(t.segments)) {
    return t.segments.map((row) => row.text || "").filter(Boolean).join("\n");
  }
  return "";
}
