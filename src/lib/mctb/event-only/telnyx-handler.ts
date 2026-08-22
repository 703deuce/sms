import { MCTB_PLATFORM_DEMO_E164 } from "@/lib/mctb/onboarding/constants";
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
 * Telnyx EVENT_ONLY handler — capture inbound metadata, queue Existing Consent SMS.
 * Never issues answer/speak/play/gather/transfer commands.
 */
export async function handleMctbEventOnlyTelnyxWebhook(input: {
  eventType: string;
  eventPayload: TelnyxPayload;
  fallbackWorkspaceId: string;
}): Promise<{ handled: boolean; action?: string; callEventId?: string }> {
  const { eventType, eventPayload, fallbackWorkspaceId } = input;
  const callControlId = String(eventPayload.call_control_id || "");
  const to = String(eventPayload.to || "");

  if (!callControlId || !isMctb571Target(to) || !isInbound(eventPayload)) {
    return { handled: false };
  }

  switch (eventType) {
    case "call.initiated": {
      logMctbEventOnly("telnyx_call_initiated", {
        callControlId,
        from: eventPayload.from,
        to: eventPayload.to,
      });

      const normalized = normalizeTelnyxMctbInboundEvent(eventPayload, {
        voiceCaptureStatus: "EVENT_CAPTURED",
      });
      if (!normalized) return { handled: true, action: "invalid_payload" };

      const result = await handleMctbInboundEvent(normalized, { fallbackWorkspaceId });
      processedCalls.set(callControlId, "captured");
      setTimeout(() => processedCalls.delete(callControlId), 10 * 60 * 1000);

      return {
        handled: true,
        action: "event_only_capture",
        callEventId: result.callEventId,
      };
    }
    case "call.hangup": {
      logMctbEventOnly("telnyx_call_hangup", {
        callControlId,
        hangupCause: eventPayload.hangup_cause ?? null,
        sipHangupCause: eventPayload.sip_hangup_cause ?? null,
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
      logMctbEventOnly(`telnyx_${eventType.replace(/\./g, "_")}`, { callControlId });
      return { handled: true, action: "ignored" };
  }
}

export function resetMctbEventOnlyTelnyxStateForTests(): void {
  processedCalls.clear();
}
