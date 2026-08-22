import {
  MCTB_PLATFORM_DEMO_E164,
  MCTB_TWILIO_VOICE_INGRESS_E164,
} from "@/lib/mctb/onboarding/constants";
import {
  captureMctbVoiceBridgeFirstHop,
  isMctb571InboundTarget,
  logMctbVoiceBridge,
  markMctbVoiceBridgeTransferRequested,
  type MctbVoiceBridgeTelnyxPayload,
} from "@/lib/mctb/voice-bridge/first-hop";

type CallPhase = "answered" | "captured" | "transferred";

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

function isInbound(payload: MctbVoiceBridgeTelnyxPayload): boolean {
  const direction = String(payload.direction || "").toLowerCase();
  return direction === "incoming" || direction === "inbound" || direction === "";
}

/**
 * Telnyx first hop: answer → capture authoritative metadata → transfer voice to Twilio 855.
 * SMS remains on Telnyx 571 (not handled here).
 */
export async function handleMctbVoiceBridgeTelnyxEvent(input: {
  eventType: string;
  eventPayload: MctbVoiceBridgeTelnyxPayload;
  fallbackWorkspaceId: string;
}): Promise<{ handled: boolean; action?: string; callEventId?: string }> {
  const { eventType, eventPayload, fallbackWorkspaceId } = input;
  const callControlId = String(eventPayload.call_control_id || "");
  const to = String(eventPayload.to || "");

  if (!callControlId || !isMctb571InboundTarget(to)) {
    return { handled: false };
  }

  const { answerCall, transferToPhone } = await import("@/lib/smart-routing/telnyx-provider");

  switch (eventType) {
    case "call.initiated": {
      if (!isInbound(eventPayload)) {
        logMctbVoiceBridge("call_initiated_skipped_outbound", { callControlId });
        return { handled: true, action: "skipped_outbound" };
      }
      logMctbVoiceBridge("call_initiated", {
        callControlId,
        from: eventPayload.from,
        to: eventPayload.to,
      });
      if (markPhase(callControlId, "answered")) {
        await answerCall(callControlId);
        logMctbVoiceBridge("answer_command_sent", { callControlId });
      }
      return { handled: true, action: "answer" };
    }
    case "call.answered": {
      logMctbVoiceBridge("call_answered", { callControlId });
      let callEventId: string | undefined;
      let workspaceId = fallbackWorkspaceId;
      if (markPhase(callControlId, "captured")) {
        const captured = await captureMctbVoiceBridgeFirstHop({
          eventPayload,
          fallbackWorkspaceId,
        });
        callEventId = captured.callEventId;
      } else {
        const { getPrisma } = await import("@/lib/db");
        const existing = await getPrisma().mctbVoiceBridgeCallEvent.findUnique({
          where: { telnyxCallControlId: callControlId },
          select: { id: true, workspaceId: true },
        });
        callEventId = existing?.id;
        workspaceId = existing?.workspaceId || fallbackWorkspaceId;
      }

      if (callEventId) {
        const { getPrisma } = await import("@/lib/db");
        const row = await getPrisma().mctbVoiceBridgeCallEvent.findUnique({
          where: { id: callEventId },
          select: { workspaceId: true },
        });
        if (row?.workspaceId) workspaceId = row.workspaceId;
      }

      if (markPhase(callControlId, "transferred") && callEventId) {
        await markMctbVoiceBridgeTransferRequested({ callEventId, callControlId });
        await transferToPhone(callControlId, MCTB_TWILIO_VOICE_INGRESS_E164, callEventId, {
          kind: "smart_routing",
          sessionId: callEventId,
          workspaceId,
          flowId: "mctb-voice-bridge",
        });
        logMctbVoiceBridge("transfer_command_sent", {
          callControlId,
          callEventId,
          to: MCTB_TWILIO_VOICE_INGRESS_E164,
        });
      }
      return { handled: true, action: "capture_and_transfer", callEventId };
    }
    case "call.hangup": {
      logMctbVoiceBridge("call_hangup", {
        callControlId,
        hangupCause: (eventPayload as Record<string, unknown>).hangup_cause ?? null,
        sipHangupCause: (eventPayload as Record<string, unknown>).sip_hangup_cause ?? null,
      });
      phaseByCall.delete(callControlId);
      return { handled: true, action: "hangup_observed" };
    }
    default:
      logMctbVoiceBridge(`event_${eventType.replace(/\./g, "_")}`, { callControlId });
      return { handled: true, action: "ignored" };
  }
}

export function resetMctbVoiceBridgeHandlerStateForTests(): void {
  phaseByCall.clear();
}

export const MCTB_TWILIO_INGRESS_DIAGNOSTIC_SAY =
  "Transovo test. Your forwarded call reached the Twilio voice layer successfully.";
