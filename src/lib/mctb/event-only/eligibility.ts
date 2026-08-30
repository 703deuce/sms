import { getPrisma } from "@/lib/db";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import { evaluateMissedCallTextEligibility } from "@/lib/agents/missed-call-text-back/eligibility";
import { loadMctbConsentMode } from "@/lib/mctb/consent-prompt/service";
import { isExistingConsentMode, isVerifiedCallConsentMode } from "@/lib/mctb/consent-mode";
import { validateExistingConsentAttestation } from "@/lib/mctb/event-only/attestation";
import type { MctbEventOnlyEligibilityStatus, MctbInboundCallEvent } from "@/lib/mctb/event-only/types";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";

export type MctbRecoveryEligibilityResult = {
  eligible: boolean;
  status: MctbEventOnlyEligibilityStatus;
  consentMode: string;
  existingConsentValid: boolean;
};

function buildEventOnlyIdempotencyKey(workspaceId: string, event: MctbInboundCallEvent): string {
  return `missed-call-text:${workspaceId}:telnyx:${event.providerCallId}`;
}

export async function resolveMctbConsentMode(workspaceId: string): Promise<string> {
  return loadMctbConsentMode(workspaceId);
}

export async function evaluateMctbRecoveryEligibility(input: {
  workspaceId: string;
  event: MctbInboundCallEvent;
  demoMode?: boolean;
}): Promise<MctbRecoveryEligibilityResult> {
  const consentMode = await loadMctbConsentMode(input.workspaceId);

  if (isVerifiedCallConsentMode(consentMode)) {
    return {
      eligible: false,
      status: "NOT_EXISTING_CONSENT",
      consentMode,
      existingConsentValid: false,
    };
  }

  if (!isExistingConsentMode(consentMode)) {
    return {
      eligible: false,
      status: "NOT_EXISTING_CONSENT",
      consentMode,
      existingConsentValid: false,
    };
  }

  const attestation = await validateExistingConsentAttestation(input.workspaceId);
  logMctbEventOnly("consent_mode_resolved", {
    consentMode: "EXISTING_CONSENT",
    existingConsentValid: attestation.existingConsentValid,
    workspaceId: input.workspaceId,
  });
  logMctbEventOnly("mctb_existing_consent_resolved", {
    workspaceId: input.workspaceId,
    existingConsentValid: attestation.existingConsentValid,
    attestationReason: attestation.reason || null,
  });

  if (!attestation.valid) {
    return {
      eligible: false,
      status: (attestation.reason as MctbEventOnlyEligibilityStatus) || "MISSING_ATTESTATION",
      consentMode,
      existingConsentValid: false,
    };
  }

  let caller = "";
  try {
    caller = normalizeE164(input.event.callerE164);
  } catch {
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

  const idempotencyKey = buildEventOnlyIdempotencyKey(input.workspaceId, input.event);
  const existing = await prisma.missedCallEvent.findUnique({ where: { idempotencyKey } });
  if (existing) {
    return {
      eligible: false,
      status: "DUPLICATE",
      consentMode,
      existingConsentValid: true,
    };
  }

  const businessE164 = input.event.forwardedFromE164 || input.event.transovoNumberE164;

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
    call: {
      direction: "inbound",
      status: "NO_ANSWER",
      disposition: "missed_no_answer",
      answeredAt: null,
      hangupCause: input.event.hangupCause,
    },
  });

  const statusMap: Record<string, MctbEventOnlyEligibilityStatus> = {
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
    return {
      eligible: false,
      status: mapped,
      consentMode,
      existingConsentValid: true,
    };
  }

  return {
    eligible: true,
    status: "ELIGIBLE",
    consentMode,
    existingConsentValid: true,
  };
}

export { buildEventOnlyIdempotencyKey };
