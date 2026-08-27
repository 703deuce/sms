import { MCTB_DIRECT_TELNYX_TEST_LOG_SOURCE } from "@/lib/mctb/direct-telnyx-test/config";
import { parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";

export type MctbDirectTelnyxSignalingSnapshot = {
  callControlId: string;
  callSessionId: string | null;
  callLegId: string | null;
  connectionId: string | null;
  from: string;
  to: string;
  forwardedFrom: string | null;
  direction: string | null;
  state: string | null;
  hangupCause: string | null;
  sipHangupCause: string | null;
  sipResponseCode: string | null;
  sipHeaders: Array<{ name: string; value: string }>;
  signalingHints: {
    hasDiversion: boolean;
    hasPAssertedIdentity: boolean;
    hasHistoryInfo: boolean;
    supported100rel: boolean | null;
    require100rel: boolean | null;
    provisional183Mentioned: boolean;
    provisional180Mentioned: boolean;
    sdpMentioned: boolean;
    prackMentioned: boolean;
    inviteMentioned: boolean;
    ackMentioned: boolean;
  };
  timestamp: string;
};

function summarizeSipHeaders(headers: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h) => h && typeof h === "object")
    .map((h) => {
      const row = h as { name?: string; value?: string };
      return { name: String(row.name || ""), value: String(row.value || "").slice(0, 400) };
    })
    .filter((h) => h.name);
}

function headerValue(
  headers: Array<{ name: string; value: string }>,
  pattern: RegExp,
): string | null {
  const row = headers.find((h) => pattern.test(h.name));
  return row?.value ?? null;
}

function scanPayloadForSignaling(payload: Record<string, unknown>): MctbDirectTelnyxSignalingSnapshot["signalingHints"] {
  const sipHeaders = summarizeSipHeaders(payload.sip_headers);
  const blob = JSON.stringify({
    sip_headers: sipHeaders,
    state: payload.state,
    hangup_cause: payload.hangup_cause,
    sip_hangup_cause: payload.sip_hangup_cause,
    sip_response_code: payload.sip_response_code,
    client_state: payload.client_state,
  }).toLowerCase();

  const supported = headerValue(sipHeaders, /^supported$/i);
  const requireHdr = headerValue(sipHeaders, /^require$/i);

  return {
    hasDiversion: Boolean(headerValue(sipHeaders, /^diversion$/i)),
    hasPAssertedIdentity: Boolean(headerValue(sipHeaders, /p-asserted-identity/i)),
    hasHistoryInfo: Boolean(headerValue(sipHeaders, /history-info/i)),
    supported100rel: supported ? /100rel/i.test(supported) : null,
    require100rel: requireHdr ? /100rel/i.test(requireHdr) : null,
    provisional183Mentioned: /183/.test(blob) || /session progress/i.test(blob),
    provisional180Mentioned: /180/.test(blob) || /ringing/i.test(blob),
    sdpMentioned: /application\/sdp/i.test(blob) || /"sdp"/i.test(blob),
    prackMentioned: /prack/i.test(blob),
    inviteMentioned: /invite/i.test(blob),
    ackMentioned: /\back\b/i.test(blob),
  };
}

export function buildSignalingSnapshot(
  payload: Record<string, unknown>,
): MctbDirectTelnyxSignalingSnapshot {
  const sipHeaders = summarizeSipHeaders(payload.sip_headers);
  return {
    callControlId: String(payload.call_control_id || ""),
    callSessionId: payload.call_session_id ? String(payload.call_session_id) : null,
    callLegId: payload.call_leg_id ? String(payload.call_leg_id) : null,
    connectionId: payload.connection_id ? String(payload.connection_id) : null,
    from: String(payload.from || ""),
    to: String(payload.to || ""),
    forwardedFrom: parseTelnyxForwardedFrom(payload) || null,
    direction: payload.direction ? String(payload.direction) : null,
    state: payload.state ? String(payload.state) : null,
    hangupCause: payload.hangup_cause ? String(payload.hangup_cause) : null,
    sipHangupCause: payload.sip_hangup_cause ? String(payload.sip_hangup_cause) : null,
    sipResponseCode: payload.sip_response_code ? String(payload.sip_response_code) : null,
    sipHeaders,
    signalingHints: scanPayloadForSignaling(payload),
    timestamp: new Date().toISOString(),
  };
}

export function logMctbDirectTelnyxTest(
  event: string,
  payload: Record<string, unknown>,
  extra?: Record<string, unknown>,
) {
  const snapshot = buildSignalingSnapshot(payload);
  console.log(
    JSON.stringify({
      source: MCTB_DIRECT_TELNYX_TEST_LOG_SOURCE,
      event,
      ...snapshot,
      livekitBypass: true,
      ...extra,
    }),
  );
}
