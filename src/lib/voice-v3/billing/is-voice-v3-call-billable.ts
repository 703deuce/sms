import type { VoiceCall } from "@prisma/client";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** One completed Voice V3 handled call → quantity 1 (not minutes/tokens). */
export function isVoiceV3CallBillable(call: Pick<VoiceCall, "metadata" | "isTest" | "status" | "answeredAt">): boolean {
  if (call.isTest) return false;
  const meta = asRecord(call.metadata);
  if (meta.voiceV3Billable === false) return false;
  if (meta.voiceV3PreCallReject === "blocklist") return false;
  if (meta.voiceV3Product !== "voice_v3" && !meta.voiceV3LiveSessionId) {
    return false;
  }
  if (!call.answeredAt && call.status !== "COMPLETED" && call.status !== "ENDED") {
    return false;
  }
  if (meta.voiceV3SolicitorDeclined === true && meta.voiceV3BillableOnSolicitorDecline !== true) {
    return false;
  }
  return true;
}

/** Canonical idempotent usage identity for Stripe / ledger (one per VoiceCall). */
export function voiceV3BillableCallUsageIdentity(voiceCallId: string): string {
  return `voice_v3_call:${voiceCallId}`;
}
