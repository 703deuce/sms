import "server-only";

export type NativeTranscriptValidation = {
  valid: boolean;
  reasons: string[];
  callerTurns: number;
  agentTurns: number;
};

export type TranscriptSegmentLike = {
  speaker: string;
  text: string;
  startMs?: number | null;
  endMs?: number | null;
};

const TOOL_LEAK = /function_call|tool_call|"name"\s*:\s*"|schema|system prompt/i;

function isCustomerSpeaker(speaker: string): "caller" | "agent" | "system" | "other" {
  const s = speaker.toLowerCase();
  if (s === "system" || s.includes("system")) return "system";
  if (s === "user" || s === "caller" || s.includes("caller")) return "caller";
  if (s === "assistant" || s === "agent" || s.includes("agent") || s.includes("assistant")) {
    return "agent";
  }
  return "other";
}

export function validateNativeCustomerTranscript(input: {
  segments: TranscriptSegmentLike[];
  durationSeconds?: number | null;
  forensicsFinal?: boolean;
}): NativeTranscriptValidation {
  const reasons: string[] = [];
  const customerSegments = input.segments.filter((seg) => {
    const role = isCustomerSpeaker(seg.speaker);
    return role === "caller" || role === "agent";
  });

  let callerTurns = 0;
  let agentTurns = 0;
  for (const seg of customerSegments) {
    const role = isCustomerSpeaker(seg.speaker);
    if (role === "caller") callerTurns += 1;
    if (role === "agent") agentTurns += 1;
    const text = (seg.text || "").trim();
    if (!text) reasons.push("empty_segment");
    if (TOOL_LEAK.test(text)) reasons.push("diagnostic_leak");
  }

  if (!customerSegments.length) reasons.push("no_segments");
  if (callerTurns < 1) reasons.push("missing_caller_turn");
  if (agentTurns < 1) reasons.push("missing_agent_turn");

  const duration = input.durationSeconds ?? 0;
  if (duration >= 30 && customerSegments.length < 2) {
    reasons.push("too_sparse_for_duration");
  }

  let lastStart = -1;
  for (const seg of customerSegments) {
    if (seg.startMs != null && seg.startMs < lastStart) {
      reasons.push("unordered_timestamps");
      break;
    }
    if (seg.startMs != null) lastStart = seg.startMs;
  }

  if (input.forensicsFinal === false) {
    reasons.push("forensics_not_final");
  }

  const unique = [...new Set(reasons)];
  return {
    valid: unique.length === 0,
    reasons: unique,
    callerTurns,
    agentTurns,
  };
}
