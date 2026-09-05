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
import { readCallHandlingMode } from "@/lib/numbers/call-handling-mode-shared";
import { traceMctbPipeline, traceMctbPipelineSkip } from "@/lib/mctb/pipeline-trace";

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

async function activeCallForwardingOnNumber(
  workspaceId: string,
  phoneNumberId: string | null | undefined,
) {
  const { hasActiveCallForwardingOnNumber } = await import("@/lib/call-forwarding/service");
  return hasActiveCallForwardingOnNumber(workspaceId, phoneNumberId);
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
  const baseFields = {
    callId: call.id,
    workspaceId: call.workspaceId,
    from: call.fromE164,
    to: call.toE164,
    status: call.status,
    answeredAt: call.answeredAt,
    direction: call.direction,
  };
  traceMctbPipeline({
    layer: "voice-missed-trigger",
    step: "start",
    outcome: "ok",
    ...baseFields,
  });

  if (!isMissedInboundVoiceCall(call)) {
    traceMctbPipelineSkip("voice-missed-trigger", "evaluate", "not_missed", baseFields);
    return { triggered: false, reason: "not_missed" };
  }

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
  traceMctbPipeline({
    layer: "voice-missed-trigger",
    step: "consent_mode_resolved",
    outcome: "ok",
    consentMode,
    targetWorkspaceId,
    isDemo,
    ...baseFields,
  });

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
    traceMctbPipelineSkip("voice-missed-trigger", "evaluate", "mctb_texml_press_1", {
      ...baseFields,
      consentMode,
      connectionId,
    });
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
  const callForwarding = await activeCallForwardingOnNumber(
    routingWorkspaceId,
    routingPhoneNumberId,
  );
  traceMctbPipeline({
    layer: "voice-missed-trigger",
    step: "routing_state",
    outcome: "ok",
    smartRouting,
    callForwarding,
    routingWorkspaceId,
    routingPhoneNumberId,
    ...baseFields,
  });

  if (routingPhoneNumberId) {
    const routingPn = await getPrisma().phoneNumber.findFirst({
      where: { id: routingPhoneNumberId, workspaceId: routingWorkspaceId },
      select: { settingsJson: true },
    });
    if (
      routingPn &&
      readCallHandlingMode(routingPn.settingsJson) === "smart_routing" &&
      !smartRouting
    ) {
      traceMctbPipelineSkip("voice-missed-trigger", "evaluate", "smart_routing_mode_paused", baseFields);
      return { triggered: false, reason: "smart_routing_mode_paused" };
    }
    if (
      routingPn &&
      readCallHandlingMode(routingPn.settingsJson) === "call_forwarding" &&
      !callForwarding
    ) {
      traceMctbPipelineSkip("voice-missed-trigger", "evaluate", "call_forwarding_mode_paused", baseFields);
      return { triggered: false, reason: "call_forwarding_mode_paused" };
    }
  }

  // Verified Call Consent: smart routing / call forwarding must own inbound before MCTB.
  if (consentMode === "press_1") {
    if (smartRouting || callForwarding) {
      const reason = smartRouting ? "smart_routing_active" : "call_forwarding_active";
      traceMctbPipelineSkip("voice-missed-trigger", "evaluate", reason, {
        ...baseFields,
        consentMode,
      });
      return { triggered: false, reason };
    }
    traceMctbPipelineSkip("voice-missed-trigger", "evaluate", "consent_prompt_not_published", {
      ...baseFields,
      consentMode,
    });
    return { triggered: false, reason: "consent_prompt_not_published" };
  }

  // Existing Consent: proceed directly (no Press-1). Production still defers if unrelated SR/CF active.
  if (!isDemo && (smartRouting || callForwarding)) {
    const reason = smartRouting ? "smart_routing_active" : "call_forwarding_active";
    traceMctbPipelineSkip("voice-missed-trigger", "evaluate", reason, {
      ...baseFields,
      consentMode,
      isDemo,
    });
    return { triggered: false, reason };
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
    traceMctbPipelineSkip("voice-missed-trigger", "evaluate", "trigger_disabled", {
      ...baseFields,
      classification,
      configEnabled: config.enabled,
    });
    return { triggered: false, reason: "trigger_disabled", classification };
  }

  traceMctbPipeline({
    layer: "voice-missed-trigger",
    step: "process_missed_inbound_call",
    outcome: "ok",
    targetWorkspaceId,
    classification,
    isDemo,
    ...baseFields,
  });

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
  traceMctbPipeline({
    layer: "voice-missed-trigger",
    step: "process_complete",
    outcome: result.scheduled ? "queued" : result.eligible === false ? "suppressed" : "ok",
    result,
    traceId: result.traceId,
    missedCallEventId: result.missedCallEventId,
    ...baseFields,
  });
  return { triggered: true, result, classification, demoMode: isDemo };
}
