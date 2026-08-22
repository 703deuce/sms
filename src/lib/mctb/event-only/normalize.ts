import { parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";
import type { MctbInboundCallEvent } from "@/lib/mctb/event-only/types";

function summarizeDiversionHeader(payload: Record<string, unknown>): string | null {
  const headers = payload.sip_headers;
  if (!Array.isArray(headers)) return null;
  for (const raw of headers) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as { name?: string; value?: string };
    if (String(row.name || "").toLowerCase() === "diversion") {
      return String(row.value || "").slice(0, 500) || null;
    }
  }
  return null;
}

/** Normalize Telnyx Call Control payload → internal MCTB inbound event. */
export function normalizeTelnyxMctbInboundEvent(
  payload: Record<string, unknown>,
  input?: { receivedAt?: Date; voiceCaptureStatus?: MctbInboundCallEvent["voiceCaptureStatus"] },
): MctbInboundCallEvent | null {
  const callControlId = String(payload.call_control_id || "");
  const caller = String(payload.from || "");
  const transovoNumber = String(payload.to || "");
  if (!callControlId || !caller || !transovoNumber) return null;

  const forwardedFrom = parseTelnyxForwardedFrom(payload) || null;

  return {
    provider: "TELNYX",
    providerCallId: callControlId,
    providerSessionId: payload.call_session_id ? String(payload.call_session_id) : null,
    providerCallLegId: payload.call_leg_id ? String(payload.call_leg_id) : null,
    connectionId: payload.connection_id ? String(payload.connection_id) : null,
    callerE164: caller,
    transovoNumberE164: transovoNumber,
    forwardedFromE164: forwardedFrom,
    diversionHeader: summarizeDiversionHeader(payload),
    receivedAt: input?.receivedAt || new Date(),
    rawDisposition: payload.state ? String(payload.state) : null,
    hangupCause: payload.hangup_cause ? String(payload.hangup_cause) : null,
    sipHangupCause: payload.sip_hangup_cause ? String(payload.sip_hangup_cause) : null,
    voiceCaptureStatus: input?.voiceCaptureStatus || "EVENT_CAPTURED",
  };
}
