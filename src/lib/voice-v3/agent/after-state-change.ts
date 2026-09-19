import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { assertVoiceV3RuntimeInvariants } from "./runtime-invariants";
import type { AgentStateSnapshot } from "./agent-state-snapshot";
import { planAgentState } from "./agent-planner";

export type LiveSendFn = (event: { type: string; [key: string]: unknown }) => void;

let lastSnapshotByCall = new Map<string, AgentStateSnapshot>();

export function getLastAgentSnapshotForCall(callId: string): AgentStateSnapshot | null {
  return lastSnapshotByCall.get(callId) ?? null;
}

/** Test-only */
export function clearAgentSnapshotStore(): void {
  lastSnapshotByCall.clear();
}

/**
 * Post-mutation hook: invariants + diagnostic snapshot only.
 * Does not plan Amy's speech or push planner snapshots to Live.
 */
export function afterVoiceV3StateChange(input: {
  runtime: VoiceV3CallRuntime;
  reason: string;
  send?: LiveSendFn;
  now?: Date;
}): AgentStateSnapshot {
  const ctx = input.runtime.getSnapshot();
  const violations = assertVoiceV3RuntimeInvariants(ctx, { throwOnViolation: false });
  if (violations.length > 0) {
    console.error("VOICE_V3_INVARIANT_VIOLATION", {
      call_id: ctx.callId,
      violations,
      reason: input.reason,
    });
  }

  const planned = planAgentState(ctx, input.runtime.config, input.now);
  const snapshot: AgentStateSnapshot = {
    ...planned,
    nextConversationAction: { type: "NONE" },
  };
  lastSnapshotByCall.set(ctx.callId, snapshot);

  logVoiceV3Pipeline("state", "after_change", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    state_version: snapshot.stateVersion,
    reason: input.reason,
    allowed_claims: snapshot.allowedClaims,
  });

  if (ctx.booking.phase === "BOOKING_CONFIRMED" && ctx.booking.confirmed && input.send) {
    const display = ctx.booking.confirmed.displayTime;
    input.send({
      type: "session.commentary.append",
      content: `Verified: appointment booking is confirmed for ${display}. You may tell the caller it is booked.`,
      delegation_id: null,
    });
  }

  return snapshot;
}
