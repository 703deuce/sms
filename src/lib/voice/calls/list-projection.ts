import type { VoiceCall } from "@prisma/client";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function projectCallListFields(call: Pick<VoiceCall, "metadata" | "outcome" | "appointmentBooked" | "transferred">) {
  const meta = asRecord(call.metadata);
  const analytics = asRecord(meta.voiceV3Analytics);
  const screening = asRecord(meta.voiceV3Screening);
  const reasonForCall =
    (typeof analytics.reasonForCall === "string" ? analytics.reasonForCall : null) ||
    null;
  const needsAttention = analytics.actionRequired === true;
  const v3Outcome = typeof analytics.outcome === "string" ? analytics.outcome : null;
  const spamLikely =
    screening.spamLikely === true ||
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
