import {
  isMctbDirectTelnyxTestTarget,
  mctbDirectTelnyxTestHoldMs,
  MCTB_DIRECT_TELNYX_TEST_SAY,
} from "@/lib/mctb/direct-telnyx-test/config";
import { emitDirectTelnyxNormalizedEvent } from "@/lib/mctb/direct-telnyx-test/emit-event";
import { logMctbDirectTelnyxTest } from "@/lib/mctb/direct-telnyx-test/signaling-log";

type CallPhase = "answered" | "spoken" | "hold_complete" | "hungup";

type CallState = {
  phases: Set<CallPhase>;
  answeredAt: string | null;
  initiatedAt: string;
  holdTimer?: ReturnType<typeof setTimeout>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const stateByCall = new Map<string, CallState>();

function scheduleCleanup(callControlId: string) {
  const state = stateByCall.get(callControlId);
  if (!state) return;
  if (state.cleanupTimer) clearTimeout(state.cleanupTimer);
  state.cleanupTimer = setTimeout(() => {
    const current = stateByCall.get(callControlId);
    if (current?.phases.has("hungup")) stateByCall.delete(callControlId);
  }, 15 * 60 * 1000);
  state.cleanupTimer.unref?.();
}

function markPhase(callControlId: string, phase: CallPhase): boolean {
  let state = stateByCall.get(callControlId);
  if (!state) {
    state = {
      phases: new Set(),
      answeredAt: null,
      initiatedAt: new Date().toISOString(),
    };
    stateByCall.set(callControlId, state);
  }
  if (state.phases.has(phase)) return false;
  state.phases.add(phase);
  scheduleCleanup(callControlId);
  return true;
}

function isInbound(payload: Record<string, unknown>): boolean {
  const direction = String(payload.direction || "").toLowerCase();
  return direction === "incoming" || direction === "inbound" || direction === "";
}

function clearHoldTimer(callControlId: string) {
  const state = stateByCall.get(callControlId);
  if (state?.holdTimer) {
    clearTimeout(state.holdTimer);
    state.holdTimer = undefined;
  }
}

/**
 * Direct Telnyx isolation handler — bypass LiveKit, prove FQDN signaling stability.
 *
 * call.initiated → answer (immediate)
 * call.answered → speak short prompt, start hold timer
 * hold timer → log stability checkpoint (do not auto-hangup — let caller hang up)
 * call.hangup → emit normalized missed/forwarded event
 */
export async function handleMctbDirectTelnyxTestEvent(input: {
  eventType: string;
  eventPayload: Record<string, unknown>;
}): Promise<{ handled: boolean; action?: string }> {
  const { eventType, eventPayload } = input;
  const callControlId = String(eventPayload.call_control_id || "");
  const to = String(eventPayload.to || "");

  if (!callControlId || !isMctbDirectTelnyxTestTarget(to)) {
    return { handled: false };
  }

  const { answerCall, speakOnCall } = await import("@/lib/smart-routing/telnyx-provider");

  switch (eventType) {
    case "call.initiated": {
      if (!isInbound(eventPayload)) {
        logMctbDirectTelnyxTest("call_initiated_skipped_outbound", eventPayload);
        return { handled: true, action: "skipped_outbound" };
      }
      logMctbDirectTelnyxTest("call_initiated", eventPayload, {
        inviteReceived: true,
        livekitRoomCreated: false,
      });
      if (markPhase(callControlId, "answered")) {
        try {
          await answerCall(callControlId);
          logMctbDirectTelnyxTest("answer_command_sent", eventPayload, {
            provisionalResponseExpected: "183_session_progress_or_180",
          });
        } catch (err) {
          logMctbDirectTelnyxTest("answer_command_failed", eventPayload, {
            error: err instanceof Error ? err.message : String(err),
          });
          throw err;
        }
      }
      return { handled: true, action: "answer" };
    }
    case "call.answered": {
      const answeredAt = new Date().toISOString();
      const state = stateByCall.get(callControlId);
      if (state) state.answeredAt = answeredAt;

      logMctbDirectTelnyxTest("call_answered", eventPayload, {
        mediaEstablished: true,
        livekitRoomCreated: false,
        answeredAt,
      });

      if (markPhase(callControlId, "spoken")) {
        try {
          await speakOnCall(callControlId, MCTB_DIRECT_TELNYX_TEST_SAY);
          logMctbDirectTelnyxTest("speak_command_sent", eventPayload, {
            text: MCTB_DIRECT_TELNYX_TEST_SAY,
          });
        } catch (err) {
          logMctbDirectTelnyxTest("speak_command_failed", eventPayload, {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const holdMs = mctbDirectTelnyxTestHoldMs();
      if (markPhase(callControlId, "hold_complete")) {
        const holdTimer = setTimeout(() => {
          logMctbDirectTelnyxTest("hold_stability_checkpoint", eventPayload, {
            holdDurationMs: holdMs,
            status: "PASS_HOLD_THRESHOLD",
            livekitRoomCreated: false,
          });
        }, holdMs);
        holdTimer.unref?.();
        const current = stateByCall.get(callControlId);
        if (current) current.holdTimer = holdTimer;
      }

      return { handled: true, action: "speak_and_hold" };
    }
    case "call.speak.ended": {
      logMctbDirectTelnyxTest("speech_finished", eventPayload);
      return { handled: true, action: "speech_finished" };
    }
    case "call.hangup": {
      clearHoldTimer(callControlId);
      const state = stateByCall.get(callControlId);
      const answeredAt = state?.answeredAt ?? null;
      const initiatedAt = state?.initiatedAt ?? null;
      const holdDurationMs =
        answeredAt && initiatedAt
          ? Math.max(0, Date.now() - new Date(answeredAt).getTime())
          : null;

      logMctbDirectTelnyxTest("call_hangup", eventPayload, {
        holdDurationMs,
        livekitRoomCreated: false,
        finalOutcome: true,
      });

      if (markPhase(callControlId, "hungup")) {
        await emitDirectTelnyxNormalizedEvent({
          payload: eventPayload,
          holdDurationMs,
          answeredAt,
        });
      }

      stateByCall.delete(callControlId);
      return { handled: true, action: "hangup_observed" };
    }
    default:
      logMctbDirectTelnyxTest(`event_${eventType.replace(/\./g, "_")}`, eventPayload);
      return { handled: true, action: "ignored" };
  }
}

/** Test helper — reset in-memory state between fixture runs. */
export function resetMctbDirectTelnyxTestStateForTests(): void {
  for (const state of stateByCall.values()) {
    if (state.holdTimer) clearTimeout(state.holdTimer);
    if (state.cleanupTimer) clearTimeout(state.cleanupTimer);
  }
  stateByCall.clear();
}
