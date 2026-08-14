/**
 * Shared missed-call detection + John MCTB trigger for voice calls.
 *
 * Answered = we received an explicit provider answer signal (call.answered /
 * TeXML answered|in-progress), stored as VoiceCall.answeredAt.
 * We never infer "answered" from TeXML AnsweredTime — Telnyx echoes StartTime
 * on ring-outs.
 */
import type { VoiceCall } from "@prisma/client";
import { classifyInboundCallOutcome, classificationTriggersMctb } from "@/lib/agents/missed-call-text-back/classify";
import { loadMissedCallTextConfig } from "@/lib/agents/missed-call-text-back/config";

const MISSED_STATUSES = new Set(["NO_ANSWER", "BUSY", "CANCELLED", "FAILED"]);

export function isMissedInboundVoiceCall(call: Pick<
  VoiceCall,
  | "status"
  | "answeredAt"
  | "voicemailDetected"
  | "appointmentBooked"
  | "direction"
>): boolean {
  const status = String(call.status || "").toUpperCase();
  if (MISSED_STATUSES.has(status)) return true;
  if (String(call.direction || "").toUpperCase() === "OUTBOUND") return false;
  if (call.voicemailDetected || call.appointmentBooked) return false;
  // Terminal without a real answer event (answeredAt only set on call.answered).
  if (!call.answeredAt && status === "COMPLETED") return true;
  return false;
}

async function activeSmartRoutingOnNumber(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
) {
  const { hasActiveSmartRoutingOnNumber } = await import(
    "@/lib/smart-routing/flow-service"
  );
  return hasActiveSmartRoutingOnNumber(workspaceId, phoneNumberId);
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

  if (await activeSmartRoutingOnNumber(call.workspaceId, call.phoneNumberId)) {
    return { triggered: false, reason: "smart_routing_active" };
  }

  const config = await loadMissedCallTextConfig(call.workspaceId);
  const classification = classifyInboundCallOutcome({
    direction: call.direction,
    status: call.status,
    disposition: call.outcome,
    answeredAt: call.answeredAt,
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
      answeredAt: call.answeredAt,
      voicemailDetected: call.voicemailDetected,
    },
  });
  return { triggered: true, result, classification };
}
