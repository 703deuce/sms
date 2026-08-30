import { MCTB_571_SIP_FQDN_CONNECTION_ID } from "@/lib/mctb/sip-diagnostic/constants";
import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  normalizeForwardedFromE164,
  parseTelnyxForwardedFrom,
} from "@/lib/voice/telnyx/forwarded-from";
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
  };
}

function extractForwardedFromSipAttributes(
  attrs: Record<string, string>,
): { forwardedFromE164?: string; diversionHeader?: string } {
  for (const [key, value] of Object.entries(attrs)) {
    const lowered = key.toLowerCase();
    if (
      !lowered.includes("diversion") &&
      !lowered.includes("forward") &&
      !lowered.includes("history-info")
    ) {
      continue;
    }
    const raw = String(value || "").slice(0, 500);
    const forwardedFromE164 = normalizeForwardedFromE164(raw);
    if (forwardedFromE164 || raw) {
      return { forwardedFromE164, diversionHeader: raw || undefined };
    }
  }
  return {};
}

/** Normalize LiveKit/Telnyx SIP ingress → same MctbInboundCallEvent shape as EVENT_ONLY. */
export function normalizeSipMctbInboundEvent(input: {
  providerCallId: string;
  callerE164: string;
  transovoNumberE164?: string;
  forwardedFromE164?: string | null;
  diversionHeader?: string | null;
  connectionId?: string | null;
  livekitRoomName?: string | null;
  receivedAt?: Date;
  voiceCaptureStatus?: MctbInboundCallEvent["voiceCaptureStatus"];
  sipAttributes?: Record<string, string>;
}): MctbInboundCallEvent | null {
  const caller = String(input.callerE164 || "").trim();
  const transovoNumber = String(input.transovoNumberE164 || MCTB_PLATFORM_DEMO_E164).trim();
  const providerCallId = String(input.providerCallId || "").trim();
  if (!caller || !transovoNumber || !providerCallId) return null;

  const fromAttrs = input.sipAttributes
    ? extractForwardedFromSipAttributes(input.sipAttributes)
    : {};
  const forwardedFrom =
    normalizeForwardedFromE164(input.forwardedFromE164 || "") ||
    fromAttrs.forwardedFromE164 ||
    null;

  return {
    provider: "TELNYX_SIP",
    providerCallId,
    providerSessionId: input.livekitRoomName || null,
    providerCallLegId: null,
    connectionId: input.connectionId || MCTB_571_SIP_FQDN_CONNECTION_ID,
    callerE164: caller,
    transovoNumberE164: transovoNumber,
    forwardedFromE164: forwardedFrom,
    diversionHeader:
      input.diversionHeader || fromAttrs.diversionHeader || null,
    receivedAt: input.receivedAt || new Date(),
    rawDisposition: null,
    hangupCause: null,
    sipHangupCause: null,
    voiceCaptureStatus: input.voiceCaptureStatus || "EVENT_CAPTURED",
  };
}
