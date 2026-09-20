import "server-only";

export type VoiceV3ScreeningCallMetadata = {
  transovoOutcome?: string | null;
  customerBillable?: boolean | null;
  spamLikely?: boolean | null;
  solicitor?: boolean | null;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Read screening / spam fields persisted on VoiceCall.metadata (Voice V3). */
export function readVoiceV3ScreeningFromCallMetadata(
  metadata: unknown,
): VoiceV3ScreeningCallMetadata | null {
  const meta = asRecord(metadata);
  const screening = asRecord(meta.voiceV3Screening);
  if (!Object.keys(screening).length) {
    const legacy = asRecord(meta.screening);
    if (!Object.keys(legacy).length) return null;
    return {
      transovoOutcome: legacy.transovoOutcome != null ? String(legacy.transovoOutcome) : null,
      customerBillable:
        typeof legacy.customerBillable === "boolean" ? legacy.customerBillable : null,
      spamLikely: typeof legacy.spamLikely === "boolean" ? legacy.spamLikely : null,
      solicitor: typeof legacy.solicitor === "boolean" ? legacy.solicitor : null,
    };
  }
  return {
    transovoOutcome:
      screening.transovoOutcome != null ? String(screening.transovoOutcome) : null,
    customerBillable:
      typeof screening.customerBillable === "boolean" ? screening.customerBillable : null,
    spamLikely: typeof screening.spamLikely === "boolean" ? screening.spamLikely : null,
    solicitor: typeof screening.solicitor === "boolean" ? screening.solicitor : null,
  };
}
