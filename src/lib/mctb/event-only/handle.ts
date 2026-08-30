import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { processMissedInboundCall } from "@/lib/agents/missed-call-text-back/process";
import { resolveMctbTargetWorkspaceForInboundCall } from "@/lib/mctb/onboarding/demo-workspace-target";
import {
  buildEventOnlyIdempotencyKey,
  evaluateMctbRecoveryEligibility,
} from "@/lib/mctb/event-only/eligibility";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";
import type { MctbCaptureMode, MctbInboundCallEvent } from "@/lib/mctb/event-only/types";

const FALLBACK_WORKSPACE_ID =
  process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";

export type HandleMctbInboundEventResult = {
  ok: boolean;
  callEventId?: string;
  missedCallEventId?: string;
  eligible?: boolean;
  eligibilityStatus?: string;
  deduped?: boolean;
  reason?: string;
};

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
 * Core MCTB EVENT_ONLY handler — capture metadata, enforce Existing Consent, queue SMS.
 * Never answers, plays audio, or issues Call Control media commands.
 */
export async function handleMctbInboundEvent(
  event: MctbInboundCallEvent,
  input?: { fallbackWorkspaceId?: string; lockWorkspaceId?: string },
): Promise<HandleMctbInboundEventResult> {
  const fallbackWorkspaceId = input?.fallbackWorkspaceId || FALLBACK_WORKSPACE_ID;

  const target = input?.lockWorkspaceId
    ? { workspaceId: input.lockWorkspaceId, isPlatformDemo: false, demoMode: false }
    : await resolveMctbTargetWorkspaceForInboundCall({
        callerE164: event.callerE164,
        businessE164: event.transovoNumberE164,
        fallbackWorkspaceId,
        forwardedFrom: event.forwardedFromE164,
      });

  const businessE164 = event.forwardedFromE164 || event.transovoNumberE164;
  const phoneNumberId = await resolvePhoneNumberId(
    target.workspaceId,
    event.transovoNumberE164,
  );

  logMctbEventOnly("inbound_call_captured", {
    caller: event.callerE164,
    transovoNumber: event.transovoNumberE164,
    businessNumber: businessE164,
    providerCallId: event.providerCallId,
    workspaceId: target.workspaceId,
    voiceCaptureStatus: event.voiceCaptureStatus || "EVENT_CAPTURED",
    hasForwardMetadata: Boolean(event.forwardedFromE164 || event.diversionHeader),
  });

  const idempotencyKey = buildEventOnlyIdempotencyKey(target.workspaceId, event);
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
      call: {
        direction: "inbound",
        status: "NO_ANSWER",
        disposition: "missed_no_answer",
        answeredAt: null,
        hangupCause: event.hangupCause,
      },
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
    call: {
      direction: "inbound",
      status: "NO_ANSWER",
      disposition: "missed_no_answer",
      answeredAt: null,
      hangupCause: event.hangupCause,
    },
  });

  logMctbEventOnly("recovery_sms_queued", {
    callEventId: result.missedCallEventId,
    workspaceId: target.workspaceId,
    caller: event.callerE164,
    eligible: result.eligible !== false,
    scheduled: result.scheduled === true,
  });
  logMctbEventOnly("mctb_sms_job_queued", {
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

function resolveCaptureMode(event: MctbInboundCallEvent): MctbCaptureMode {
  return event.provider === "TELNYX_SIP" ? "SIP_INGRESS" : "EVENT_ONLY";
}

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
    captureMode: resolveCaptureMode(event),
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

/** Queue wrapper — scheduling is performed inside processMissedInboundCall when eligible. */
export async function enqueueMctbRecoverySms(input: {
  workspaceId: string;
  missedCallEventId: string;
  traceId: string;
  delaySeconds?: number;
}) {
  const { scheduleMissedCallText } = await import("@/lib/agents/missed-call-text-back/schedule");
  await scheduleMissedCallText(input);
}
