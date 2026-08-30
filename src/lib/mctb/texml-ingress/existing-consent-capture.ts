import "server-only";

import { handleMctbInboundEvent } from "@/lib/mctb/event-only/handle";
import { normalizeTelnyxMctbInboundEvent } from "@/lib/mctb/event-only/normalize";
import { traceMctbTexml } from "./trace";

/** Async existing_consent capture for TeXML MCTB legs (post-call, not blocking voice). */
export function scheduleMctbTexmlExistingConsentCapture(input: {
  eventPayload: Record<string, unknown>;
  workspaceId: string;
}): void {
  const normalized = normalizeTelnyxMctbInboundEvent(input.eventPayload, {
    voiceCaptureStatus: "EVENT_CAPTURED",
  });
  if (!normalized) return;

  traceMctbTexml("MCTB_CALL_COMPLETED", {
    workspaceId: input.workspaceId,
    to: normalized.transovoNumberE164,
    from: normalized.callerE164,
    callSid: normalized.providerCallId,
    consentMode: "existing_consent",
  });

  void handleMctbInboundEvent(normalized, {
    fallbackWorkspaceId: input.workspaceId,
  }).catch((err) => {
    console.error("[mctb-texml-ingress] existing_consent capture failed", err);
  });
}
