/**
 * Shared missed-call detection + John MCTB trigger for voice calls.
 */
import type { VoiceCall } from "@prisma/client";
import { classifyInboundCallOutcome, classificationTriggersMctb } from "@/lib/agents/missed-call-text-back/classify";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";

export function wasCallGenuinelyAnswered(call: {
  answeredAt: Date | null;
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  voicemailDetected?: boolean | null;
  appointmentBooked?: boolean | null;
  outcome?: string | null;
  agentId?: string | null;
}): boolean {
  if (call.voicemailDetected || call.appointmentBooked) return true;
  const outcome = String(call.outcome || "").toLowerCase();
  if (
    outcome &&
    /booked|message_taken|transferred|answered|completed_booking/.test(outcome)
  ) {
    return true;
  }
  if (!call.answeredAt) return false;
  if (call.startedAt) {
    const answeredOffsetMs = call.answeredAt.getTime() - call.startedAt.getTime();
    // False positive: answeredAt stamped at ring/start without a live session (TeXML / ensure-call bug).
    if (answeredOffsetMs < 5_000 && !call.agentId) {
      return false;
    }
  }
  return true;
}

export function isMissedInboundVoiceCall(call: Pick<
  VoiceCall,
  | "status"
  | "answeredAt"
  | "startedAt"
  | "endedAt"
  | "durationSeconds"
  | "voicemailDetected"
  | "appointmentBooked"
  | "outcome"
  | "agentId"
  | "direction"
>): boolean {
  const missedStatuses = ["NO_ANSWER", "BUSY", "CANCELLED", "FAILED"];
  if (missedStatuses.includes(call.status)) return true;
  if (String(call.direction || "").toLowerCase() === "outbound") return false;
  if (wasCallGenuinelyAnswered(call)) return false;
  return true;
}

export async function triggerJohnMctbForVoiceCall(call: Pick<
  VoiceCall,
  | "id"
  | "workspaceId"
  | "fromE164"
  | "toE164"
  | "phoneNumberId"
  | "contactId"
  | "telnyxCallControlId"
  | "status"
  | "outcome"
  | "answeredAt"
  | "startedAt"
  | "endedAt"
  | "durationSeconds"
  | "voicemailDetected"
  | "appointmentBooked"
  | "agentId"
  | "direction"
>) {
  if (!isMissedInboundVoiceCall(call)) return { triggered: false, reason: "not_missed" };

  const config = await loadMissedCallTextConfig(call.workspaceId);
  const classification = classifyInboundCallOutcome({
    direction: call.direction,
    status: call.status,
    disposition: call.outcome,
    answeredAt: wasCallGenuinelyAnswered(call) ? call.answeredAt : null,
    voicemailDetected: call.voicemailDetected,
  });
  if (!classificationTriggersMctb(classification, config)) {
    return { triggered: false, reason: "trigger_disabled", classification };
  }

  const { processMissedInboundCall } = await import(
    "@/lib/agents/missed-call-text-back/process"
  );
  const result = await processMissedInboundCall({
    workspaceId: call.workspaceId,
    callerE164: call.fromE164,
    businessE164: call.toE164,
    phoneNumberId: call.phoneNumberId,
    voiceCallId: call.id,
    contactId: call.contactId,
    providerCallId: call.telnyxCallControlId,
    call: {
      direction: call.direction,
      status: call.status,
      disposition: call.outcome,
      answeredAt: wasCallGenuinelyAnswered(call) ? call.answeredAt : null,
      voicemailDetected: call.voicemailDetected,
    },
  });
  return { triggered: true, result, classification };
}
