import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
import {
  MCTB_571_SIP_FQDN_CONNECTION_ID,
  MCTB_FQDN_DIRECT_TEST_E164,
} from "@/lib/mctb/sip-diagnostic/constants";
import { handleMctbInboundEvent } from "@/lib/mctb/event-only/handle";
import { logMctbEventOnly } from "@/lib/mctb/event-only/logging";
import { normalizeTelnyxMctbInboundEvent } from "@/lib/mctb/event-only/normalize";

type TelnyxPayload = Record<string, unknown>;

const processedCalls = new Map<string, "captured" | "hangup_only">();

function isInbound(payload: TelnyxPayload): boolean {
  const direction = String(payload.direction || "").toLowerCase();
  return direction === "incoming" || direction === "inbound" || direction === "";
}

function isMctb571Target(to: string): boolean {
  return to === MCTB_PLATFORM_DEMO_E164;
}

/**
 * FQDN SIP direct path — same Telnyx connection + signaling as LiveKit ingress,
 * but 3PCC webhook terminates in existing MCTB event-only handler (no LiveKit room).
 */
export function isFqdnDirectMctbTarget(payload: TelnyxPayload): boolean {
  const connectionId = String(payload.connection_id || "");
  const to = String(payload.to || "");
  if (connectionId !== MCTB_571_SIP_FQDN_CONNECTION_ID) return false;
  if (isMctb571Target(to)) return false;
  return to === MCTB_FQDN_DIRECT_TEST_E164;
}

function isMctbEventOnlyTarget(payload: TelnyxPayload): boolean {
  const to = String(payload.to || "");
  if (isMctb571Target(to)) return true;
  return isFqdnDirectMctbTarget(payload);
}

/**
 * Telnyx EVENT_ONLY handler — capture inbound metadata, queue Existing Consent SMS.
 * FQDN direct path answers via Call Control so forwarded calls stay up (3PCC hold).
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

      const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, {
        voiceCaptureStatus: fqdnDirect ? "EVENT_CAPTURED" : "EVENT_CAPTURED",
      });
      if (!normalized) return { handled: true, action: "invalid_payload" };

      const result = await handleMctbInboundEvent(normalized, { fallbackWorkspaceId });
      processedCalls.set(callControlId, "captured");
      setTimeout(() => processedCalls.delete(callControlId), 10 * 60 * 1000);

      return {
        handled: true,
        action: fqdnDirect ? "fqdn_direct_capture" : "event_only_capture",
        callEventId: result.callEventId,
      };
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
        const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, {
          voiceCaptureStatus: "VOICE_TERMINATION_FAILED",
        });
        if (normalized) {
          await handleMctbInboundEvent(normalized, { fallbackWorkspaceId });
        }
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
