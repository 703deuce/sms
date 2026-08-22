/**
 * Shared missed-call detection + John MCTB trigger for voice calls.
 *
 * Answered = we received an explicit provider answer signal (call.answered /
 * TeXML answered|in-progress), stored as VoiceCall.answeredAt.
 * We never infer "answered" from TeXML AnsweredTime — Telnyx echoes StartTime
 * on ring-outs.
 */
import type { VoiceCall } from "@prisma/client";
import { getPrisma } from "@/lib/db";
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

  const { resolveOnboardingWorkspaceForDemoCall } = await import(
    "@/lib/agents/missed-call-text-back/demo-bypass"
  );
  const demoWorkspaceId = await resolveOnboardingWorkspaceForDemoCall(
    call.fromE164,
    call.toE164,
  );
  const targetWorkspaceId = demoWorkspaceId || call.workspaceId;
  const isDemo = Boolean(demoWorkspaceId);

  const { loadMctbConsentMode } = await import("@/lib/mctb/consent-prompt/service");
  const consentMode = await loadMctbConsentMode(targetWorkspaceId);

  const { isPlatform571E164, isMctb571ConsentTexmlConnection } = await import(
    "@/lib/mctb/consent-prompt/telnyx-texml-route"
  );
  const meta =
    call && typeof (call as { metadata?: unknown }).metadata === "object"
      ? ((call as { metadata?: Record<string, unknown> }).metadata as Record<string, unknown>)
      : null;
  const payload =
    meta?.payload && typeof meta.payload === "object"
      ? (meta.payload as Record<string, unknown>)
      : null;
  const connectionId = String(payload?.ConnectionId || payload?.connection_id || "");
  if (
    isPlatform571E164(call.toE164) &&
    (isMctb571ConsentTexmlConnection(connectionId) || consentMode === "press_1")
  ) {
    return { triggered: false, reason: "mctb_texml_press_1" };
  }

  // Platform 571 smart routing lives on the owner workspace, not the onboarding workspace.
  let routingWorkspaceId = call.workspaceId;
  let routingPhoneNumberId = call.phoneNumberId;
  if (isDemo) {
    const { isPlatformDemoNumber } = await import("@/lib/mctb/onboarding/demo");
    if (isPlatformDemoNumber(call.toE164)) {
      const { resolvePlatformDemoOwnerWorkspaceId } = await import(
        "@/lib/mctb/onboarding/platform-demo"
      );
      const ownerId = await resolvePlatformDemoOwnerWorkspaceId();
      if (ownerId) {
        routingWorkspaceId = ownerId;
        const platformPn = await getPrisma().phoneNumber.findFirst({
          where: { workspaceId: ownerId, e164: call.toE164 },
          select: { id: true },
        });
        routingPhoneNumberId = platformPn?.id || call.phoneNumberId;
      }
    }
  }

  const smartRouting = await activeSmartRoutingOnNumber(
    routingWorkspaceId,
    routingPhoneNumberId,
  );

  // Verified Call Consent: smart routing must own inbound before MCTB direct-send.
  if (consentMode === "press_1") {
    if (smartRouting) {
      return { triggered: false, reason: "smart_routing_active" };
    }
    return { triggered: false, reason: "consent_prompt_not_published" };
  }

  // Existing Consent: proceed directly (no Press-1). Production still defers if unrelated SR active.
  if (!isDemo && smartRouting) {
    return { triggered: false, reason: "smart_routing_active" };
  }

  const config = await loadMissedCallTextConfig(targetWorkspaceId);
  const classification = classifyInboundCallOutcome({
    direction: call.direction,
    status: call.status,
    disposition: call.outcome,
    answeredAt: call.answeredAt,
    voicemailDetected: call.voicemailDetected,
  });
  if (!isDemo && !classificationTriggersMctb(classification, config)) {
    return { triggered: false, reason: "trigger_disabled", classification };
  }

  const { processMissedInboundCall } = await import(
    "@/lib/agents/missed-call-text-back/process"
  );
  const result = await processMissedInboundCall({
    workspaceId: targetWorkspaceId,
    callerE164: call.fromE164,
    businessE164: call.toE164,
    phoneNumberId: call.phoneNumberId,
    voiceCallId: call.id,
    contactId: call.contactId,
    providerCallId: call.telnyxCallControlId,
    demoMode: isDemo,
    call: {
      direction: call.direction,
      status: call.status,
      disposition: call.outcome,
      answeredAt: call.answeredAt,
      voicemailDetected: call.voicemailDetected,
    },
  });
  return { triggered: true, result, classification, demoMode: isDemo };
}
