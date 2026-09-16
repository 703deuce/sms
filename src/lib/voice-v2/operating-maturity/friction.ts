import type { VoiceV2CallContext } from "../intake/types";
import type { VoiceV2FrictionSignal, VoiceV2FrictionSignalType } from "./types";

export function detectRealtimeFrictionSignals(input: {
  ctx: VoiceV2CallContext;
  callMeta?: Record<string, unknown>;
}): VoiceV2FrictionSignal[] {
  const out: VoiceV2FrictionSignal[] = [];
  const meta = input.callMeta || {};

  if (meta.voiceV2DeclinedAiChannel === true) {
    out.push(signal("AI_REFUSAL", 1, "high", "Caller declined AI channel"));
  }
  if (meta.voiceV2HumanRequest === true) {
    out.push(signal("HUMAN_REQUEST", 1, "medium", "Caller requested human"));
  }

  for (const [key, mem] of Object.entries(input.ctx.askedFields)) {
    const field = input.ctx.intakeState[key];
    if (mem && mem.count >= 2 && field?.status === "CAPTURED") {
      out.push(
        signal(
          "REPEATED_REASK",
          0.9,
          "medium",
          `Field ${key} re-asked after capture`,
        ),
      );
    }
  }

  if (Number(meta.voiceV2TalkoverCount ?? 0) > 2) {
    out.push(signal("AGENT_TALKOVER", 0.8, "medium", "Agent talk-over detected"));
  }
  if (Number(meta.voiceV2CallerTalkoverCount ?? 0) > 2) {
    out.push(signal("CALLER_TALKOVER", 0.7, "low", "Caller interruption pattern"));
  }
  if (Number(meta.voiceV2LongSilenceMs ?? 0) > 8000) {
    out.push(signal("LONG_SILENCE", 0.85, "medium", "Long silence before response"));
  }

  const duration = Number(meta.durationSeconds ?? 0);
  const meaningful = Number(meta.voiceV2MeaningfulUtterances ?? 0);
  if (duration > 0 && duration < 20 && meaningful === 0) {
    out.push(signal("EARLY_ABANDONMENT", 0.75, "low", "Early hangup"));
  }

  return dedupeSignals(out);
}

export type PostCallFrictionLlmResult = {
  frictionSignals: Array<{
    type: VoiceV2FrictionSignalType;
    confidence: number;
    severity: "low" | "medium" | "high";
    evidence: string;
  }>;
};

/** Telemetry-only merge — post-call LLM may add FRUSTRATION / REPEATED_MISUNDERSTANDING. */
export function mergeFrictionSignals(
  realtime: VoiceV2FrictionSignal[],
  postCall?: PostCallFrictionLlmResult | null,
): VoiceV2FrictionSignal[] {
  const merged = [...realtime];
  for (const row of postCall?.frictionSignals || []) {
    merged.push({
      type: row.type,
      confidence: row.confidence,
      severity: row.severity,
      evidence: row.evidence,
      measuredAt: new Date().toISOString(),
    });
  }
  return dedupeSignals(merged);
}

function signal(
  type: VoiceV2FrictionSignalType,
  confidence: number,
  severity: VoiceV2FrictionSignal["severity"],
  evidence: string,
): VoiceV2FrictionSignal {
  return {
    type,
    confidence,
    severity,
    evidence,
    measuredAt: new Date().toISOString(),
  };
}

function dedupeSignals(signals: VoiceV2FrictionSignal[]): VoiceV2FrictionSignal[] {
  const seen = new Set<string>();
  const out: VoiceV2FrictionSignal[] = [];
  for (const s of signals) {
    const k = s.type;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}
