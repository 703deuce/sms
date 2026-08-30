import {
  parseTelnyxForwardedFrom,
} from "@/lib/voice/telnyx/forwarded-from";
import type { MctbInboundCallEvent } from "@/lib/mctb/capture/types";

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

/** Normalize TeXML status_callback payload → canonical MCTB inbound call event. */
export function normalizeTelnyxMctbInboundEvent(
  payload: Record<string, unknown>,
  input?: { receivedAt?: Date; voiceCaptureStatus?: MctbInboundCallEvent["voiceCaptureStatus"] },
): MctbInboundCallEvent | null {
  const callControlId = String(
    payload.call_control_id || payload.CallSid || payload.call_sid || "",
  );
  const caller = String(payload.from || payload.From || payload.Caller || "");
  const transovoNumber = String(payload.to || payload.To || payload.Called || "");
  if (!callControlId || !caller || !transovoNumber) return null;

  const forwardedFrom = parseTelnyxForwardedFrom(payload) || null;
  const texmlCallStatus = String(
    payload.texml_call_status || payload.CallStatus || payload.call_status || "",
  ).trim() || null;
  const durationRaw = payload.call_duration ?? payload.CallDuration ?? payload.Duration;
  const callDurationSeconds =
    durationRaw != null && String(durationRaw).trim() !== ""
      ? Number(durationRaw) || null
      : null;

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
    rawDisposition: payload.state ? String(payload.state) : texmlCallStatus,
    hangupCause: payload.hangup_cause
      ? String(payload.hangup_cause)
      : texmlCallStatus,
    sipHangupCause: payload.sip_hangup_cause ? String(payload.sip_hangup_cause) : null,
    voiceCaptureStatus: input?.voiceCaptureStatus || "EVENT_CAPTURED",
    texmlCallStatus,
    callDurationSeconds,
    ingressPath: "texml",
  };
}
