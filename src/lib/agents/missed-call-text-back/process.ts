import { getPrisma } from "@/lib/db";
import { createId } from "@/lib/supabase/id";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";
import type { ClassifyInboundCallInput } from "./classify";
import { classifyInboundCallOutcome } from "./classify";
import { evaluateMissedCallTextEligibility } from "./eligibility";
import { scheduleMissedCallText } from "./schedule";
import { appendMctbTrace, newMctbTraceId } from "./trace";

export type ProcessMissedCallInput = {
  workspaceId: string;
  callerE164: string;
  businessE164: string;
  phoneNumberId?: string | null;
  voiceCallId?: string | null;
  humanCallId?: string | null;
  contactId?: string | null;
  providerCallId?: string | null;
  demoMode?: boolean;
  eventOnly?: boolean;
  eventMetadata?: Record<string, unknown>;
  forceEligibilityStatus?: string;
  call: ClassifyInboundCallInput;
};

function buildIdempotencyKey(input: ProcessMissedCallInput): string {
  if (input.eventOnly && input.providerCallId) {
    return `missed-call-text:${input.workspaceId}:telnyx:${input.providerCallId}`;
  }
  const provider =
    input.providerCallId ||
    input.voiceCallId ||
    input.humanCallId ||
    createId();
  return `missed-call-text:${input.workspaceId}:${provider}`;
}

/**
 * Deterministic John MCTB entry — classify, persist event, eligibility, schedule.
 * LLM is never involved in this path.
 */
export async function processMissedInboundCall(input: ProcessMissedCallInput) {
  const prisma = getPrisma();
  const traceId = newMctbTraceId();
  const classification = classifyInboundCallOutcome(input.call);
  const idempotencyKey = buildIdempotencyKey(input);

  let caller = input.callerE164;
  try {
    caller = normalizeE164(input.callerE164);
  } catch {
    return { ok: false, reason: "INVALID_PHONE", traceId };
  }

  let contactId = input.contactId || null;
  if (!contactId) {
    const { ensureInboundCallerContact } = await import(
      "@/lib/automations/inbound-trigger-enroll"
    );
    const contact = await ensureInboundCallerContact({
      workspaceId: input.workspaceId,
      fromE164: caller,
    }).catch(() => null);
    contactId = contact?.id || null;
  }

  const existing = await prisma.missedCallEvent.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      deduped: true,
      missedCallEventId: existing.id,
      traceId: existing.traceId,
      status: existing.status,
    };
  }

  const event = await prisma.missedCallEvent.create({
    data: {
      workspaceId: input.workspaceId,
      voiceCallId: input.voiceCallId || null,
      humanCallId: input.humanCallId || null,
      contactId,
      callerE164: caller,
      businessE164: input.businessE164,
      phoneNumberId: input.phoneNumberId || null,
      reason: classification,
      disposition: input.call.disposition || null,
      status: "DETECTED",
      traceId,
      idempotencyKey,
      metadata: {
        ...(input.demoMode ? { demoMode: true } : {}),
        ...(input.eventMetadata || {}),
      },
    },
  });

  await appendMctbTrace({
    workspaceId: input.workspaceId,
    traceId,
    missedCallEventId: event.id,
    voiceCallId: input.voiceCallId || null,
    humanCallId: input.humanCallId || null,
    kind: "call.missed",
    detail: { classification, caller, business: input.businessE164 },
  });

  if (input.demoMode) {
    const { recordDemoCallDetected } = await import("@/lib/mctb/onboarding/demo");
    await recordDemoCallDetected({
      workspaceId: input.workspaceId,
      missedCallEventId: event.id,
    }).catch(() => undefined);
  }

  const eligibility = await evaluateMissedCallTextEligibility({
    workspaceId: input.workspaceId,
    callerE164: caller,
    businessE164: input.businessE164,
    phoneNumberId: input.phoneNumberId,
    idempotencyKey,
    demoMode: input.demoMode,
    eventOnly: input.eventOnly,
    forwardedFromE164:
      typeof input.eventMetadata?.forwardedFromE164 === "string"
        ? input.eventMetadata.forwardedFromE164
        : typeof input.eventMetadata?.forwardedFrom === "string"
          ? input.eventMetadata.forwardedFrom
          : null,
    transovoNumberE164:
      typeof input.eventMetadata?.transovoNumberE164 === "string"
        ? input.eventMetadata.transovoNumberE164
        : input.businessE164,
    call: input.call,
  });

  if (!eligibility.eligible) {
    const suppressionReason = input.forceEligibilityStatus || eligibility.reason;
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SUPPRESSED",
        eligible: false,
        suppressionReason,
      },
    });
    await appendMctbTrace({
      workspaceId: input.workspaceId,
      traceId,
      missedCallEventId: event.id,
      kind: "mctb.eligibility.failed",
      detail: { reason: eligibility.reason },
    });
    return {
      ok: true,
      missedCallEventId: event.id,
      traceId,
      eligible: false,
      reason: eligibility.reason,
    };
  }

  await prisma.missedCallEvent.update({
    where: { id: event.id },
    data: { eligible: true, status: "ELIGIBILITY_CHECK" },
  });
  await appendMctbTrace({
    workspaceId: input.workspaceId,
    traceId,
    missedCallEventId: event.id,
    kind: "mctb.eligibility.passed",
  });

  const { loadMctbConsentMode } = await import("@/lib/mctb/consent-prompt/service");
  const { isExistingConsentMode } = await import("@/lib/mctb/consent-mode");
  const consentMode = await loadMctbConsentMode(input.workspaceId);
  if (input.eventOnly && !isExistingConsentMode(consentMode)) {
    await prisma.missedCallEvent.update({
      where: { id: event.id },
      data: {
        status: "SUPPRESSED",
        eligible: false,
        suppressionReason: "NOT_EXISTING_CONSENT",
      },
    });
    return {
      ok: true,
      missedCallEventId: event.id,
      traceId,
      eligible: false,
      reason: "NOT_EXISTING_CONSENT",
    };
  }

  if (isExistingConsentMode(consentMode)) {
    const { recordExistingConsentAttestation } = await import("@/lib/mctb/consent-attestation");
    await recordExistingConsentAttestation({
      workspaceId: input.workspaceId,
      callerNumber: caller,
      businessNumber: input.businessE164,
      voiceCallId: input.voiceCallId,
      contactId,
      metadata: {
        demoMode: Boolean(input.demoMode),
        missedCallEventId: event.id,
      },
    });
  }

  const delaySeconds = input.demoMode ? 0 : undefined;
  await scheduleMissedCallText({
    workspaceId: input.workspaceId,
    missedCallEventId: event.id,
    traceId,
    delaySeconds,
    demoMode: input.demoMode,
  });

  return {
    ok: true,
    missedCallEventId: event.id,
    traceId,
    eligible: true,
    scheduled: true,
  };
}
