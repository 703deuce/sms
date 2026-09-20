import type { VoiceCall } from "@prisma/client";
import { readVoiceV3ScreeningFromCallMetadata } from "@/lib/voice-v3/spam-protection/call-metadata";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function projectCallListFields(call: Pick<VoiceCall, "metadata" | "outcome" | "appointmentBooked" | "transferred">) {
  const meta = asRecord(call.metadata);
  const analytics = asRecord(meta.voiceV3Analytics);
  const screening = readVoiceV3ScreeningFromCallMetadata(meta) || {};
  const reasonForCall =
    (typeof analytics.reasonForCall === "string" ? analytics.reasonForCall : null) ||
    null;
  const needsAttention = analytics.actionRequired === true;
  const v3Outcome = typeof analytics.outcome === "string" ? analytics.outcome : null;
  const spamLikely =
    screening.suspectedSpamLikely === true ||
    screening.spamLikely === true ||
    screening.carrierScreeningNormalized === "spam_likely" ||
    v3Outcome === "SPAM" ||
    String(call.outcome || "").toLowerCase().includes("spam");
  const solicitor =
    screening.solicitor === true ||
    v3Outcome === "SOLICITOR" ||
    screening.transovoOutcome === "UNWANTED_SOLICITATION";

  return {
    reasonForCall,
    needsAttention,
    v3Outcome,
    spamLikely,
    solicitor,
  };
}
