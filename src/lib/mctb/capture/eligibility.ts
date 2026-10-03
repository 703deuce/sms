import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { evaluateMissedCallTextEligibility } from "@/lib/agents/missed-call-text-back/eligibility";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { isExistingConsentMode, isVerifiedCallConsentMode } from "@/lib/mctb/consent-mode";
import { validateExistingConsentAttestation } from "@/lib/mctb/capture/attestation";
import type { MctbCaptureEligibilityStatus, MctbInboundCallEvent } from "@/lib/mctb/capture/types";
import { buildMctbTexmlTerminalCallInput } from "@/lib/mctb/texml-ingress/texml-call-classification";
import { logMctbCapture } from "@/lib/mctb/capture/logging";
import { traceMctbPipeline, traceMctbPipelineSkip } from "@/lib/mctb/pipeline-trace";

export type MctbRecoveryEligibilityResult = {
  eligible: boolean;
  status: MctbCaptureEligibilityStatus;
  consentMode: string;
  existingConsentValid: boolean;
};

export function buildMctbCaptureIdempotencyKey(workspaceId: string, event: MctbInboundCallEvent): string {
  return `missed-call-text:${workspaceId}:telnyx:${event.providerCallId}`;
}

/** @deprecated Use buildMctbCaptureIdempotencyKey */
export const buildEventOnlyIdempotencyKey = buildMctbCaptureIdempotencyKey;

export async function resolveMctbConsentMode(workspaceId: string): Promise<string> {
  return loadMctbConsentMode(workspaceId);
}

export async function evaluateMctbRecoveryEligibility(input: {
  workspaceId: string;
  event: MctbInboundCallEvent;
  demoMode?: boolean;
}): Promise<MctbRecoveryEligibilityResult> {
  const consentMode = await loadMctbConsentMode(input.workspaceId);

  traceMctbPipeline({
    layer: "eligibility",
    step: "start",
    outcome: "ok",
    workspaceId: input.workspaceId,
    consentMode,
    caller: input.event.callerE164,
    transovoNumber: input.event.transovoNumberE164,
    providerCallId: input.event.providerCallId,
    demoMode: Boolean(input.demoMode),
  });

  if (isVerifiedCallConsentMode(consentMode)) {
    traceMctbPipelineSkip("eligibility", "consent_mode", "not_existing_consent", {
      workspaceId: input.workspaceId,
      consentMode,
    });
    return {
      eligible: false,
      status: "NOT_EXISTING_CONSENT",
      consentMode,
      existingConsentValid: false,
    };
  }

  if (!isExistingConsentMode(consentMode)) {
    traceMctbPipelineSkip("eligibility", "consent_mode", "not_existing_consent", {
      workspaceId: input.workspaceId,
      consentMode,
    });
    return {
      eligible: false,
      status: "NOT_EXISTING_CONSENT",
      consentMode,
      existingConsentValid: false,
    };
  }

  const attestation = await validateExistingConsentAttestation(input.workspaceId);
  logMctbCapture("consent_mode_resolved", {
    consentMode: "EXISTING_CONSENT",
    existingConsentValid: attestation.existingConsentValid,
    workspaceId: input.workspaceId,
  });
  logMctbCapture("mctb_existing_consent_resolved", {
    workspaceId: input.workspaceId,
    existingConsentValid: attestation.existingConsentValid,
    attestationReason: attestation.reason || null,
  });

  if (!attestation.valid) {
    traceMctbPipelineSkip("eligibility", "attestation", attestation.reason || "missing_attestation", {
      workspaceId: input.workspaceId,
    });
    return {
      eligible: false,
      status: (attestation.reason as MctbCaptureEligibilityStatus) || "MISSING_ATTESTATION",
      consentMode,
      existingConsentValid: false,
    };
  }

  let caller = "";
  try {
    caller = normalizeE164(input.event.callerE164);
  } catch {
    traceMctbPipelineSkip("eligibility", "caller", "invalid_caller", {
      workspaceId: input.workspaceId,
      caller: input.event.callerE164,
    });
    return {
      eligible: false,
      status: "INVALID_CALLER",
      consentMode,
      existingConsentValid: true,
    };
  }

  if (caller === normalizeE164(input.event.transovoNumberE164)) {
    return {
      eligible: false,
      status: "INVALID_CALLER",
      consentMode,
      existingConsentValid: true,
    };
  }

  if (input.event.forwardedFromE164) {
    try {
      if (caller === normalizeE164(input.event.forwardedFromE164)) {
        return {
          eligible: false,
          status: "INVALID_CALLER",
          consentMode,
          existingConsentValid: true,
        };
      }
    } catch {
      // ignore invalid forwarded-from
    }
  }

  const prisma = getPrisma();
  const phoneNumber = await (async () => {
    const { resolveMctbPhoneNumberIdForWorkspace } = await import(
      "@/lib/mctb/platform-production-routing"
    );
    const phoneNumberId = await resolveMctbPhoneNumberIdForWorkspace({
      workspaceId: input.workspaceId,
      transovoE164: input.event.transovoNumberE164,
    });
    if (phoneNumberId) return { id: phoneNumberId };
    return prisma.phoneNumber.findFirst({
      where: {
        workspaceId: input.workspaceId,
        e164: input.event.transovoNumberE164,
        releasedAt: null,
      },
      select: { id: true },
    });
  })();

  const idempotencyKey = buildMctbCaptureIdempotencyKey(input.workspaceId, input.event);
  const existing = await prisma.missedCallEvent.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return {
      eligible: false,
      status: "DUPLICATE",
      consentMode,
      existingConsentValid: attestation.valid,
    };
  }

  const texmlCall = buildMctbTexmlTerminalCallInput({
    texmlCallStatus: input.event.texmlCallStatus,
    callDuration: input.event.callDurationSeconds,
    hangupCause: input.event.hangupCause,
  });

  const businessE164 = input.event.forwardedFromE164 || input.event.transovoNumberE164;

  const { buildMissedCallRecoveryUsageMetadata } = await import("@/lib/mctb/recovery-usage");
  const recoveryMeta = await buildMissedCallRecoveryUsageMetadata(input.workspaceId, {
    consentMode,
    captureMode: "TEXML",
  });

  const base = await evaluateMissedCallTextEligibility({
    workspaceId: input.workspaceId,
    callerE164: caller,
    businessE164,
    phoneNumberId: phoneNumber?.id || null,
    idempotencyKey,
    demoMode: input.demoMode,
    eventOnly: true,
    forwardedFromE164: input.event.forwardedFromE164,
    transovoNumberE164: input.event.transovoNumberE164,
    eventMetadata: recoveryMeta,
    call: texmlCall,
  });

  const statusMap: Record<string, MctbCaptureEligibilityStatus> = {
    FEATURE_DISABLED: "MCTB_DISABLED",
    COOLDOWN_ACTIVE: "COOLDOWN",
    OPTED_OUT: "SUPPRESSED",
    BLOCKED_NUMBER: "SUPPRESSED",
    ALREADY_SENT: "DUPLICATE",
    INVALID_PHONE: "INVALID_CALLER",
    ENTITLEMENT_SUSPENDED: "WORKSPACE_INACTIVE",
    TRIAL_SMS_LIMIT: "WORKSPACE_INACTIVE",
  };

  if (!base.eligible) {
    const mapped = base.reason ? statusMap[base.reason] || "SUPPRESSED" : "SUPPRESSED";
    traceMctbPipelineSkip("eligibility", "evaluate", mapped, {
      workspaceId: input.workspaceId,
      baseReason: base.reason || null,
    });
    return {
      eligible: false,
      status: mapped,
      consentMode,
      existingConsentValid: true,
    };
  }

  traceMctbPipeline({
    layer: "eligibility",
    step: "evaluate",
    outcome: "ok",
    workspaceId: input.workspaceId,
    status: "ELIGIBLE",
    consentMode,
  });

  return {
    eligible: true,
    status: "ELIGIBLE",
    consentMode,
    existingConsentValid: true,
  };
}
