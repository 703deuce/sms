import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { processMissedInboundCall } from "@/lib/agents/missed-call-text-back/process";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import {
  buildMctbCaptureIdempotencyKey,
  evaluateMctbRecoveryEligibility,
} from "@/lib/mctb/capture/eligibility";
import { logMctbCapture } from "@/lib/mctb/capture/logging";
import { buildMctbTexmlTerminalCallInput } from "@/lib/mctb/texml-ingress/texml-call-classification";
import type { MctbInboundCallEvent } from "@/lib/mctb/capture/types";

function buildCallInput(event: MctbInboundCallEvent) {
  if (event.texmlCallStatus || event.callDurationSeconds != null) {
    return buildMctbTexmlTerminalCallInput({
      texmlCallStatus: event.texmlCallStatus,
      callDuration: event.callDurationSeconds,
      hangupCause: event.hangupCause,
    });
  }
  return {
    direction: "inbound" as const,
    status: "NO_ANSWER",
    disposition: "missed_no_answer",
    answeredAt: null,
    hangupCause: event.hangupCause,
  };
}

export type CaptureMctbMissedCallResult = {
  ok: boolean;
  callEventId?: string;
  missedCallEventId?: string;
  eligible?: boolean;
  eligibilityStatus?: string;
  deduped?: boolean;
  reason?: string;
};

/** @deprecated Use CaptureMctbMissedCallResult */
export type HandleMctbInboundEventResult = CaptureMctbMissedCallResult;

async function resolvePhoneNumberId(
  workspaceId: string,
  transovoNumberE164: string,
): Promise<string | null> {
  const { resolveMctbPhoneNumberIdForWorkspace } = await import(
    "@/lib/mctb/platform-production-routing"
  );
  return resolveMctbPhoneNumberIdForWorkspace({
    workspaceId,
    transovoE164: transovoNumberE164,
  });
}

/**
 * Canonical MCTB missed-call capture — TeXML terminal events only.
 * Records metadata, enforces existing_consent eligibility, queues SMS.
 */
export async function captureMctbMissedCall(
  event: MctbInboundCallEvent,
  input?: { lockWorkspaceId?: string },
): Promise<CaptureMctbMissedCallResult> {
  const target = input?.lockWorkspaceId
    ? { workspaceId: input.lockWorkspaceId, isPlatformDemo: false, demoMode: false }
    : await resolveMctbTargetWorkspaceForInboundCall({
        callerE164: event.callerE164,
        businessE164: event.transovoNumberE164,
        forwardedFrom: event.forwardedFromE164,
      });

  if (!target.workspaceId) {
    logMctbCapture("workspace_unresolved", {
      caller: event.callerE164,
      transovoNumber: event.transovoNumberE164,
      providerCallId: event.providerCallId,
    });
    return { ok: false, reason: "workspace_unresolved" };
  }

  const callInput = buildCallInput(event);

  const businessE164 = event.forwardedFromE164 || event.transovoNumberE164;
  const phoneNumberId = await resolvePhoneNumberId(
    target.workspaceId,
    event.transovoNumberE164,
  );

  logMctbCapture("inbound_call_captured", {
    caller: event.callerE164,
    transovoNumber: event.transovoNumberE164,
    businessNumber: businessE164,
    providerCallId: event.providerCallId,
    workspaceId: target.workspaceId,
    voiceCaptureStatus: event.voiceCaptureStatus || "EVENT_CAPTURED",
    hasForwardMetadata: Boolean(event.forwardedFromE164 || event.diversionHeader),
  });

  const idempotencyKey = buildMctbCaptureIdempotencyKey(target.workspaceId, event);
  const prisma = getPrisma();
  const existing = await prisma.missedCallEvent.findUnique({ where: { idempotencyKey } });
  if (existing) {
    if (event.voiceCaptureStatus === "VOICE_TERMINATION_FAILED") {
      const meta =
        existing.metadata && typeof existing.metadata === "object"
          ? (existing.metadata as Record<string, unknown>)
          : {};
      await prisma.missedCallEvent.update({
        where: { id: existing.id },
        data: {
          metadata: {
            ...meta,
            voiceCaptureStatus: "VOICE_TERMINATION_FAILED",
            hangupCause: event.hangupCause || null,
            sipHangupCause: event.sipHangupCause || null,
          },
        },
      });
    }
    return {
      ok: true,
      deduped: true,
      missedCallEventId: existing.id,
      callEventId: existing.id,
      eligibilityStatus: existing.suppressionReason || existing.status,
    };
  }

  const eligibility = await evaluateMctbRecoveryEligibility({
    workspaceId: target.workspaceId,
    event,
    demoMode: target.demoMode,
  });

  if (!eligibility.eligible) {
    const result = await processMissedInboundCall({
      workspaceId: target.workspaceId,
      callerE164: event.callerE164,
      businessE164,
      phoneNumberId,
      providerCallId: event.providerCallId,
      demoMode: target.demoMode,
      eventOnly: true,
      forceEligibilityStatus: eligibility.status,
      eventMetadata: buildEventMetadata(event, eligibility),
      call: callInput,
    });
    return {
      ok: true,
      missedCallEventId: result.missedCallEventId,
      callEventId: result.missedCallEventId,
      eligible: false,
      eligibilityStatus: eligibility.status,
      reason: eligibility.status,
      deduped: result.deduped,
    };
  }

  const result = await processMissedInboundCall({
    workspaceId: target.workspaceId,
    callerE164: event.callerE164,
    businessE164,
    phoneNumberId,
    providerCallId: event.providerCallId,
    demoMode: target.demoMode,
    eventOnly: true,
    eventMetadata: buildEventMetadata(event, eligibility),
    call: callInput,
  });

  logMctbCapture("recovery_sms_queued", {
    callEventId: result.missedCallEventId,
    workspaceId: target.workspaceId,
    caller: event.callerE164,
    eligible: result.eligible !== false,
    scheduled: result.scheduled === true,
  });
  logMctbCapture("mctb_sms_job_queued", {
    callEventId: result.missedCallEventId,
    workspaceId: target.workspaceId,
    caller: event.callerE164,
    provider: event.provider,
    eligible: result.eligible !== false,
    scheduled: result.scheduled === true,
  });

  return {
    ok: true,
    missedCallEventId: result.missedCallEventId,
    callEventId: result.missedCallEventId,
    eligible: result.eligible !== false,
    eligibilityStatus: eligibility.status,
    deduped: result.deduped,
    reason: result.reason || undefined,
  };
}

/** @deprecated Use captureMctbMissedCall */
export const handleMctbInboundEvent = captureMctbMissedCall;

function buildEventMetadata(
  event: MctbInboundCallEvent,
  eligibility: { status: string; consentMode: string; existingConsentValid: boolean },
) {
  let caller = event.callerE164;
  let transovo = event.transovoNumberE164;
  let business = event.forwardedFromE164 || null;
  try {
    caller = normalizeE164(event.callerE164);
    transovo = normalizeE164(event.transovoNumberE164);
    if (event.forwardedFromE164) business = normalizeE164(event.forwardedFromE164);
  } catch {
    // keep raw
  }

  return {
    captureMode: "TEXML" as const,
    ingressPath: event.ingressPath || "texml",
    provider: event.provider,
    providerCallId: event.providerCallId,
    providerSessionId: event.providerSessionId || null,
    providerCallLegId: event.providerCallLegId || null,
    connectionId: event.connectionId || null,
    transovoNumberE164: transovo,
    businessForwardedFromE164: business,
    forwardedFromE164: business,
    forwardedFrom: business,
    diversionHeader: event.diversionHeader || null,
    inboundReceivedAt: event.receivedAt.toISOString(),
    consentMode: eligibility.consentMode,
    existingConsentValid: eligibility.existingConsentValid,
    eligibilityStatus: eligibility.status,
    voiceCaptureStatus: event.voiceCaptureStatus || "EVENT_CAPTURED",
    hangupCause: event.hangupCause || null,
    sipHangupCause: event.sipHangupCause || null,
  };
}

export async function enqueueMctbRecoverySms(input: {
  workspaceId: string;
  missedCallEventId: string;
  traceId: string;
  delaySeconds?: number;
}) {
  const { scheduleMissedCallText } = await import("@/lib/agents/missed-call-text-back/schedule");
  await scheduleMissedCallText(input);
}
