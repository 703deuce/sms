import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  MCTB_FQDN_DIRECT_CONNECTION_NAME,
  MCTB_FQDN_DIRECT_TEST_E164,
} from "@/lib/mctb/sip-diagnostic/constants";
import { handleMctbInboundEvent } from "@/lib/mctb/event-only/handle";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";
import { normalizeTelnyxMctbInboundEvent } from "@/lib/mctb/event-only/normalize";
import { MCTB_CALL_CONTROL_DIAGNOSTIC_SAY } from "@/lib/mctb/consent-prompt/call-control-diagnostic";

type TelnyxPayload = Record<string, unknown>;

const processedCalls = new Map<string, "captured" | "hangup_only">();

function normalizeDid(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return value.startsWith("+") ? value : null;
}

function isInbound(payload: TelnyxPayload): boolean {
  const direction = String(payload.direction || "").toLowerCase();
  return direction === "incoming" || direction === "inbound" || direction === "";
}

function isMctb571Target(to: string): boolean {
  return normalizeDid(to) === normalizeDid(MCTB_PLATFORM_DEMO_E164);
}

/**
 * Direct FQDN test toll-free — must NOT use platform 571.
 * Gate on called number only (866 is only on the direct FQDN connection).
 */
export function isFqdnDirectMctbTarget(payload: TelnyxPayload): boolean {
  const to = normalizeDid(String(payload.to || ""));
  const test = normalizeDid(MCTB_FQDN_DIRECT_TEST_E164);
  const platform = normalizeDid(MCTB_PLATFORM_DEMO_E164);
  if (!to || !test || to === platform) return false;
  return to === test;
}

function isMctbEventOnlyTarget(payload: TelnyxPayload): boolean {
  const to = String(payload.to || "");
  if (isMctb571Target(to)) return true;
  return isFqdnDirectMctbTarget(payload);
}

function captureMctbEventAsync(
  eventPayload: TelnyxPayload,
  fallbackWorkspaceId: string,
  voiceCaptureStatus: "EVENT_CAPTURED" | "VOICE_TERMINATION_FAILED",
): void {
  const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, { voiceCaptureStatus });
  if (!normalized) return;
  void handleMctbInboundEvent(normalized, { fallbackWorkspaceId }).catch((err) => {
    logMctbEventOnly("inbound_capture_failed", {
      callControlId: eventPayload.call_control_id ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Telnyx EVENT_ONLY MCTB handler.
 * FQDN direct path: answer immediately on call.initiated (before slow DB work).
 */
export async function handleMctbEventOnlyTelnyxWebhook(input: {
  eventType: string;
  eventPayload: TelnyxPayload;
  fallbackWorkspaceId: string;
}): Promise<{ handled: boolean; action?: string; callEventId?: string }> {
  const { eventType, eventPayload, fallbackWorkspaceId } = input;
  const callControlId = String(eventPayload.call_control_id || "");
  const fqdnDirect = isFqdnDirectMctbTarget(eventPayload);

  if (!callControlId || !isMctbEventOnlyTarget(eventPayload) || !isInbound(eventPayload)) {
    return { handled: false };
  }

  switch (eventType) {
    case "call.initiated": {
      logMctbEventOnly("telnyx_call_initiated", {
        callControlId,
        from: eventPayload.from,
        to: eventPayload.to,
        connectionId: eventPayload.connection_id ?? null,
        fqdnDirect,
        livekitBypass: fqdnDirect,
      });

      if (fqdnDirect) {
        try {
          const { answerCall } = await import("@/lib/smart-routing/telnyx-provider");
          await answerCall(callControlId);
          logMctbEventOnly("fqdn_direct_answer_sent", {
            callControlId,
            livekitRoomCreated: false,
          });
        } catch (err) {
          logMctbEventOnly("fqdn_direct_answer_failed", {
            callControlId,
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }

      if (!processedCalls.has(callControlId)) {
        processedCalls.set(callControlId, "captured");
        setTimeout(() => processedCalls.delete(callControlId), 10 * 60 * 1000);
        if (fqdnDirect) {
          captureMctbEventAsync(eventPayload, fallbackWorkspaceId, "EVENT_CAPTURED");
        } else {
          const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, {
            voiceCaptureStatus: "EVENT_CAPTURED",
          });
          if (!normalized) return { handled: true, action: "invalid_payload" };
          const result = await handleMctbInboundEvent(normalized, { fallbackWorkspaceId });
          return {
            handled: true,
            action: "event_only_capture",
            callEventId: result.callEventId,
          };
        }
      }

      return {
        handled: true,
        action: fqdnDirect ? "fqdn_direct_answer" : "event_only_capture",
      };
    }
    case "call.answered": {
      if (fqdnDirect) {
        try {
          const { speakOnCall } = await import("@/lib/smart-routing/telnyx-provider");
          await speakOnCall(callControlId, MCTB_CALL_CONTROL_DIAGNOSTIC_SAY);
          logMctbEventOnly("fqdn_direct_speak_sent", { callControlId });
        } catch (err) {
          logMctbEventOnly("fqdn_direct_speak_failed", {
            callControlId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
      return { handled: true, action: fqdnDirect ? "fqdn_direct_speak" : "ignored" };
    }
    case "call.hangup": {
      logMctbEventOnly("telnyx_call_hangup", {
        callControlId,
        hangupCause: eventPayload.hangup_cause ?? null,
        sipHangupCause: eventPayload.sip_hangup_cause ?? null,
        fqdnDirect,
        livekitRoomCreated: false,
      });

      const prior = processedCalls.get(callControlId);
      if (prior === "captured") {
        captureMctbEventAsync(eventPayload, fallbackWorkspaceId, "VOICE_TERMINATION_FAILED");
        return { handled: true, action: "hangup_update_voice_status" };
      }

      const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, {
        voiceCaptureStatus: "VOICE_TERMINATION_FAILED",
      });
      if (!normalized) return { handled: true, action: "hangup_invalid_payload" };

      const result = await handleMctbInboundEvent(normalized, { fallbackWorkspaceId });
      processedCalls.set(callControlId, "captured");
      return {
        handled: true,
        action: "event_only_capture_on_hangup",
        callEventId: result.callEventId,
      };
    }
    default:
      logMctbEventOnly(`telnyx_${eventType.replace(/\./g, "_")}`, {
        callControlId,
        fqdnDirect,
      });
      return { handled: true, action: "ignored" };
  }
}

export function resetMctbEventOnlyTelnyxStateForTests(): void {
  processedCalls.clear();
}
