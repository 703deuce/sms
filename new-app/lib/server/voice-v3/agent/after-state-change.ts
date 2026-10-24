import type { VoiceV3CallRuntime } from "../state/call-runtime";
import { logVoiceV3Pipeline } from "../telemetry/pipeline-log";
import { assertVoiceV3RuntimeInvariants } from "./runtime-invariants";
import type { AgentStateSnapshot } from "./agent-state-snapshot";
import { planAgentState } from "./agent-planner";
import { LiveContextPublisher } from "../live/live-context-publisher";
import { buildAgentSnapshotLiveAppend } from "./sync-agent-state-to-live";

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
  if (prev.forbiddenClaims.join() !== next.forbiddenClaims.join()) return true;
  if (prev.activeGoal !== next.activeGoal) return true;
  return false;
}

/** Push planner snapshot to Live (Amy thinking) — LiveKit tool path or registered sideband send. */
export function pushAgentSnapshotToLive(input: {
  runtime: VoiceV3CallRuntime;
  send: LiveSendFn;
  snapshot?: AgentStateSnapshot;
  delegationId?: string | null;
}): void {
  const snapshot = input.snapshot ?? planAgentState(input.runtime.getSnapshot(), input.runtime.config);
  const base = buildAgentSnapshotLiveAppend(input.runtime, snapshot);
  const event =
    input.delegationId?.trim()
      ? { ...base, delegation_id: input.delegationId.trim() }
      : base;
  input.send(event);
}

/**
 * Authoritative replan after state mutation — pushes intent/planner snapshot to Live when send is available.
 */
export function afterVoiceV3StateChange(input: {
  runtime: VoiceV3CallRuntime;
  reason: string;
  send?: LiveSendFn;
  now?: Date;
  delegationId?: string | null;
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

  logVoiceV3Pipeline("agent", "state_planned", {
    call_id: ctx.callId,
    live_session_id: ctx.liveSessionId,
    state_version: snapshot.stateVersion,
    reason: input.reason,
    blocker_code: snapshot.blocker?.code ?? null,
    next_action: snapshot.nextConversationAction.type,
    active_goal: snapshot.activeGoal,
  });

  if (input.send && snapshotMateriallyChanged(prev, snapshot)) {
    queueMicrotask(() => {
      try {
        pushAgentSnapshotToLive({
          runtime: input.runtime,
          send: input.send!,
          snapshot,
          delegationId: input.delegationId ?? null,
        });
        console.log("AGENT_SNAPSHOT_SENT_TO_LIVE", {
          call_id: ctx.callId,
          state_version: snapshot.stateVersion,
          next_action: snapshot.nextConversationAction.type,
        });
      } catch (err) {
        console.error("AGENT_SNAPSHOT_SEND_FAILED", { call_id: ctx.callId, err });
      }
    });
  }

  if (ctx.booking.phase === "BOOKING_CONFIRMED" && ctx.booking.confirmed && input.send) {
    const display = ctx.booking.confirmed.displayTime;
    new LiveContextPublisher(input.send).appendCommentary(
      `BOOKING_CONFIRMED: appointment verified in Microsoft calendar for ${display}.`,
    );
  }

  return snapshot;
}
