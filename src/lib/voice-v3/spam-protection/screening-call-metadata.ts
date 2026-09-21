import type { VoiceV3SpamLikelyPolicy } from "./types";

export type VoiceV3ScreeningCallMetadata = {
  carrierScreeningRaw?: string | null;
  carrierScreeningNormalized?: string | null;
  suspectedSpamLikely?: boolean;
  spamLikelyPolicy?: VoiceV3SpamLikelyPolicy | null;
  transovoOutcome?: string | null;
  customerBillable?: boolean | null;
  classifiedAt?: string | null;
  spamLikely?: boolean | null;
  solicitor?: boolean | null;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function readVoiceV3ScreeningFromCallMetadata(
  metadata: unknown,
): VoiceV3ScreeningCallMetadata | null {
  const meta = asRecord(metadata);
  const raw = meta.voiceV3Screening;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as VoiceV3ScreeningCallMetadata;
  }
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

export function hasCarrierScreeningEvidence(meta: VoiceV3ScreeningCallMetadata | null): boolean {
  if (!meta) return false;
  return Boolean(
    meta.carrierScreeningNormalized &&
      meta.carrierScreeningNormalized !== "unknown" &&
      meta.carrierScreeningRaw,
  );
}
