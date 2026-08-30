import "server-only";

import { captureMctbMissedCall } from "@/lib/mctb/capture/missed-call";
import { normalizeTelnyxMctbInboundEvent } from "@/lib/mctb/event-only/normalize";
import { enqueueJob } from "@/lib/messaging/enqueue-advance";
import { traceMctbTexml } from "./trace";

export type MctbTexmlExistingConsentCaptureInput = {
  eventPayload: Record<string, unknown>;
  workspaceId: string;
  forwardedFromE164?: string | null;
};

/** Durable existing_consent capture — enqueued with idempotency per CallSid. */
export async function scheduleMctbTexmlExistingConsentCapture(
  input: MctbTexmlExistingConsentCaptureInput,
): Promise<{ queued: boolean; callSid?: string }> {
  const callSid = String(
    input.eventPayload.CallSid ||
      input.eventPayload.call_sid ||
      input.eventPayload.call_control_id ||
      "",
  ).trim();
  if (!callSid) return { queued: false };

  await enqueueJob({
    jobType: "mctb_texml_existing_consent_capture",
    queueName: "voice-calls",
    workspaceId: input.workspaceId,
    payload: input as unknown as Record<string, unknown>,
    idempotencyKey: `mctb-texml-capture:${input.workspaceId}:${callSid}`,
    priority: 20,
    maxAttempts: 8,
  });

  return { queued: true, callSid };
}

/** Worker entry — runs MCTB existing_consent SMS capture for one TeXML leg. */
export async function runMctbTexmlExistingConsentCapture(
  input: MctbTexmlExistingConsentCaptureInput,
): Promise<{ ok: boolean; reason?: string }> {
  const normalized = normalizeTelnyxMctbInboundEvent(input.eventPayload, {
    voiceCaptureStatus: "EVENT_CAPTURED",
  });
  if (!normalized) return { ok: false, reason: "normalize_failed" };

  normalized.ingressPath = "texml";

  if (!normalized.forwardedFromE164 && input.forwardedFromE164) {
    normalized.forwardedFromE164 = input.forwardedFromE164;
  }

  traceMctbTexml("MCTB_CALL_COMPLETED", {
    workspaceId: input.workspaceId,
    to: normalized.transovoNumberE164,
    from: normalized.callerE164,
    callSid: normalized.providerCallId,
    consentMode: "existing_consent",
    forwardedFrom: normalized.forwardedFromE164 || null,
    texmlCallStatus: normalized.texmlCallStatus || null,
  });

  const result = await captureMctbMissedCall(normalized, {
    lockWorkspaceId: input.workspaceId,
  });

  return {
    ok: result.ok,
    reason: result.reason || result.eligibilityStatus,
  };
}
