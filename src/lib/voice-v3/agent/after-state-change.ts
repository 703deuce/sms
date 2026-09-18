import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { planAgentState } from "./agent-planner";
import { assertVoiceV3RuntimeInvariants } from "./runtime-invariants";
import { buildAgentSnapshotLiveAppend } from "./sync-agent-state-to-live";
import type { AgentStateSnapshot } from "./agent-state-snapshot";
import { syncPlannerSpeakToLive } from "./live-speak-sync";

export type LiveSendFn = (event: { type: string; [key: string]: unknown }) => void;

let lastSnapshotByCall = new Map<string, AgentStateSnapshot>();

export function getLastAgentSnapshotForCall(callId: string): AgentStateSnapshot | null {
  return lastSnapshotByCall.get(callId) ?? null;
}

/** Test-only */
export function clearAgentSnapshotStore(): void {
  lastSnapshotByCall.clear();
}

function snapshotMateriallyChanged(
  prev: AgentStateSnapshot | null,
  next: AgentStateSnapshot,
): boolean {
  if (!prev) return true;
  if (prev.stateVersion !== next.stateVersion) return true;
  if (JSON.stringify(prev.nextConversationAction) !== JSON.stringify(next.nextConversationAction)) {
    return true;
  }
  if (prev.blocker?.code !== next.blocker?.code) return true;
  if (prev.allowedClaims.join() !== next.allowedClaims.join()) return true;
  return false;
}

/**
 * Authoritative replan after state mutation — does not await network I/O.
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

  const snapshot = planAgentState(ctx, input.runtime.config, input.now);
  const prev = lastSnapshotByCall.get(ctx.callId) ?? null;
  lastSnapshotByCall.set(ctx.callId, snapshot);

  console.log("AGENT_STATE_PLANNED", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    state_version: snapshot.stateVersion,
    reason: input.reason,
    active_goal: snapshot.activeGoal,
    goal_status: snapshot.goalStatus,
    known_field_keys: snapshot.knownFieldKeys,
    missing_field_keys: snapshot.missingRequiredFieldKeys,
    scheduling_status: snapshot.schedulingStatus,
    availability_status: snapshot.availabilityStatus,
    active_operation_types: snapshot.activeOperations.map((o) => o.type),
    blocker_code: snapshot.blocker?.code ?? null,
    next_conversation_action: snapshot.nextConversationAction.type,
    allowed_claims: snapshot.allowedClaims,
  });

  logVoiceV3Pipeline("agent", "state_planned", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    state_version: snapshot.stateVersion,
    reason: input.reason,
    blocker_code: snapshot.blocker?.code ?? null,
    next_action: snapshot.nextConversationAction.type,
  });

  if (snapshotMateriallyChanged(prev, snapshot)) {
    console.log("NEXT_CONVERSATION_ACTION_CHANGED", {
      call_id: ctx.callId,
      state_version: snapshot.stateVersion,
      action: snapshot.nextConversationAction.type,
    });
  }

  if (input.send && snapshotMateriallyChanged(prev, snapshot)) {
    const event = buildAgentSnapshotLiveAppend(input.runtime, snapshot);
    queueMicrotask(() => {
      try {
        input.send!(event);
        console.log("AGENT_SNAPSHOT_SENT_TO_LIVE", {
          call_id: ctx.callId,
          state_version: snapshot.stateVersion,
        });
        syncPlannerSpeakToLive({
          liveSessionId: ctx.liveSessionId,
          snapshot,
          prevSnapshot: prev,
          send: input.send,
        });
      } catch (err) {
        console.error("AGENT_SNAPSHOT_SEND_FAILED", { call_id: ctx.callId, err });
      }
    });
  }

  return snapshot;
}
