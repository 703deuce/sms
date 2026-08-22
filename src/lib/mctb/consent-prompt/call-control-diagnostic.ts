import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import { parseTelnyxForwardedFrom } from "@/lib/voice/telnyx/forwarded-from";

export const MCTB_CALL_CONTROL_DIAGNOSTIC_SAY =
  "Transovo test. Your forwarded call reached us successfully.";

export const MCTB_CALL_CONTROL_LOG_SOURCE = "mctb-call-control";

type CallPhase = "answered" | "spoken" | "hungup";

const phaseByCall = new Map<string, Set<CallPhase>>();

function markPhase(callControlId: string, phase: CallPhase): boolean {
  let set = phaseByCall.get(callControlId);
  if (!set) {
    set = new Set();
    phaseByCall.set(callControlId, set);
  }
  if (set.has(phase)) return false;
  set.add(phase);
  setTimeout(() => phaseByCall.delete(callControlId), 10 * 60 * 1000);
  return true;
}

function summarizeSipHeaders(headers: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h) => h && typeof h === "object")
    .map((h) => {
      const row = h as { name?: string; value?: string };
      return { name: String(row.name || ""), value: String(row.value || "").slice(0, 200) };
    })
    .filter((h) => h.name);
}

export function logMctbCallControl(
  event: string,
  payload: Record<string, unknown>,
  extra?: Record<string, unknown>,
) {
  const callControlId = String(payload.call_control_id || "");
  const from = String(payload.from || "");
  const to = String(payload.to || "");
  const forwardedFrom = parseTelnyxForwardedFrom(payload) || null;
  console.log(
    JSON.stringify({
      source: MCTB_CALL_CONTROL_LOG_SOURCE,
      event,
      callControlId,
      callSessionId: payload.call_session_id ?? null,
      callLegId: payload.call_leg_id ?? null,
      providerCallId: payload.call_session_id ?? payload.call_leg_id ?? null,
      connectionId: payload.connection_id ?? null,
      from,
      to,
      forwardedFrom,
      direction: payload.direction ?? null,
      state: payload.state ?? null,
      hangupCause: payload.hangup_cause ?? null,
      sipHangupCause: payload.sip_hangup_cause ?? null,
      sipResponseCode: payload.sip_response_code ?? null,
      sipHeaders: summarizeSipHeaders(payload.sip_headers),
      timestamp: new Date().toISOString(),
      ...extra,
    }),
  );
}

export function isMctb571CallControlTarget(to: string): boolean {
  return to === MCTB_PLATFORM_DEMO_E164;
}

function isInbound(payload: Record<string, unknown>): boolean {
  const direction = String(payload.direction || "").toLowerCase();
  return direction === "incoming" || direction === "inbound" || direction === "";
}

/**
 * Minimal Call Control diagnostic — no DB, Gather, SMS, or Play.
 * call.initiated → answer
 * call.answered → speak
 * call.speak.ended → hangup
 */
export async function handleMctbCallControlDiagnosticEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean; action?: string }> {
  const { eventType, eventPayload } = input;
  const callControlId = String(eventPayload.call_control_id || "");
  const to = String(eventPayload.to || "");

  if (!callControlId || !isMctb571CallControlTarget(to)) {
    return { handled: false };
  }

  const { answerCall, speakOnCall, hangupCall } = await import(
    "@/lib/smart-routing/telnyx-provider"
  );

  switch (eventType) {
    case "call.initiated": {
      if (!isInbound(eventPayload)) {
        logMctbCallControl("call_initiated_skipped_outbound", eventPayload);
        return { handled: true, action: "skipped_outbound" };
      }
      logMctbCallControl("call_initiated", eventPayload);
      if (markPhase(callControlId, "answered")) {
        try {
          await answerCall(callControlId);
          logMctbCallControl("answer_command_sent", eventPayload);
        } catch (err) {
          logMctbCallControl("answer_command_failed", eventPayload, {
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      } else {
        logMctbCallControl("answer_command_duplicate_ignored", eventPayload);
      }
      return { handled: true, action: "answer" };
    }
    case "call.answered": {
      logMctbCallControl("call_answered", eventPayload);
      if (markPhase(callControlId, "spoken")) {
        try {
          await speakOnCall(callControlId, MCTB_CALL_CONTROL_DIAGNOSTIC_SAY);
          logMctbCallControl("speak_command_sent", eventPayload, {
            text: MCTB_CALL_CONTROL_DIAGNOSTIC_SAY,
          });
        } catch (err) {
          logMctbCallControl("speak_command_failed", eventPayload, {
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      } else {
        logMctbCallControl("speak_command_duplicate_ignored", eventPayload);
      }
      return { handled: true, action: "speak" };
    }
    case "call.speak.ended": {
      logMctbCallControl("speech_finished", eventPayload);
      if (markPhase(callControlId, "hungup")) {
        try {
          await hangupCall(callControlId);
          logMctbCallControl("hangup_command_sent", eventPayload);
        } catch (err) {
          logMctbCallControl("hangup_command_failed", eventPayload, {
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      } else {
        logMctbCallControl("hangup_command_duplicate_ignored", eventPayload);
      }
      return { handled: true, action: "hangup" };
    }
    case "call.hangup": {
      logMctbCallControl("call_hangup", eventPayload, {
        hangupCause: eventPayload.hangup_cause ?? null,
        sipHangupCause: eventPayload.sip_hangup_cause ?? null,
      });
      phaseByCall.delete(callControlId);
      return { handled: true, action: "hangup_observed" };
    }
    default:
      logMctbCallControl(`event_${eventType.replace(/\./g, "_")}`, eventPayload);
      return { handled: true, action: "ignored" };
  }
}

/** Test helper — reset in-memory idempotency between fixture runs. */
export function resetMctbCallControlDiagnosticStateForTests(): void {
  phaseByCall.clear();
}
