import "server-only";

export type VoiceV2ContextMetric =
  | "VOICE_V2_CONTEXT_L1_HIT"
  | "VOICE_V2_CONTEXT_L1_MISS"
  | "VOICE_V2_CONTEXT_L2_HIT"
  | "VOICE_V2_CONTEXT_L2_MISS"
  | "VOICE_V2_CONTEXT_RECONSTRUCTED"
  | "VOICE_V2_CONTEXT_RECOVERY_FAILED"
  | "VOICE_V2_CONTEXT_CAS_APPLIED"
  | "VOICE_V2_CONTEXT_CAS_STALE"
  | "VOICE_V2_CONTEXT_ENDED_WRITE_REJECTED";

const counts = new Map<VoiceV2ContextMetric, number>();

export function voiceV2ContextMetric(event: VoiceV2ContextMetric, detail?: Record<string, unknown>): void {
  counts.set(event, (counts.get(event) || 0) + 1);
  if (process.env.VOICE_V2_CONTEXT_METRICS === "1" || process.env.NODE_ENV === "test") {
    console.info("[voice-v2/context-metric]", event, detail ?? {});
  }
}

/** Test helper */
export function resetVoiceV2ContextMetrics(): void {
  counts.clear();
}

export function getVoiceV2ContextMetricCount(event: VoiceV2ContextMetric): number {
  return counts.get(event) || 0;
}
