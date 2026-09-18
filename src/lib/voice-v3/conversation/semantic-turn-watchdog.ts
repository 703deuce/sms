import { getVoiceV3CallRuntime } from "../state/call-runtime";
import { getVoiceV3LiveResponseCoordinator } from "../delegation/live-response-coordinator";
import { applyExtractedCallerMeaning } from "../intake/apply-extracted-meaning";
import { claimCallerMeaningFingerprint } from "../intake/delegated-response-dedup";
import { runDirectCallerMeaningExtraction } from "../intake/direct-caller-meaning-extraction";
import type { CallerTurn } from "./caller-turn-manager";
import {
  getCommittedTurnsSinceLastSemanticApply,
  getLatestCommittedCallerTurn,
  markCallerTurnSemanticApplied,
  markCallerTurnSemanticFailed,
  markCallerTurnSemanticRunning,
} from "./caller-turn-manager";
import { getVoiceV3LiveSend } from "../state/call-runtime";

const STALL_COMMITTED_TURN_THRESHOLD = 2;
const DIRECT_SEMANTIC_DEFER_MS = 1_200;
const semanticInFlight = new Set<string>();
const directAttemptByTurn = new Set<string>();
const directTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function isSemanticInterpretationInFlight(liveSessionId: string): boolean {
  return semanticInFlight.has(liveSessionId.trim());
}

export function markSemanticInterpretationStarted(liveSessionId: string): void {
  semanticInFlight.add(liveSessionId.trim());
}

export function markSemanticInterpretationEnded(liveSessionId: string): void {
  semanticInFlight.delete(liveSessionId.trim());
}

export function onCallerTurnCommitted(input: {
  liveSessionId: string;
  turn: CallerTurn;
  rollingTranscript: string;
}): void {
  const sessionId = input.liveSessionId.trim();
  const runtime = getVoiceV3CallRuntime(sessionId);
  if (!runtime) return;

  const coordinator = getVoiceV3LiveResponseCoordinator(sessionId, () => {});
  if (coordinator.hasPendingFunctionOutputs() || coordinator.hasOpenDelegationAwaitingTool()) {
    console.log("SEMANTIC_TURN_QUEUED", {
      live_session_id: sessionId,
      turn_id: input.turn.turnId,
      reason: "delegation_tool_output_pending",
    });
    return;
  }

  if (isSemanticInterpretationInFlight(sessionId)) {
    console.log("SEMANTIC_TURN_QUEUED", {
      live_session_id: sessionId,
      turn_id: input.turn.turnId,
      reason: "semantic_already_running",
    });
    return;
  }

  const stalled = getCommittedTurnsSinceLastSemanticApply(sessionId);
  if (stalled >= STALL_COMMITTED_TURN_THRESHOLD) {
    console.log("FORWARD_PROGRESS_STALLED", {
      live_session_id: sessionId,
      committed_turns_since_apply: stalled,
      turn_sequence: input.turn.sequence,
    });
  }

  const existing = directTimers.get(sessionId);
  if (existing) clearTimeout(existing);
  directTimers.set(
    sessionId,
    setTimeout(() => {
      directTimers.delete(sessionId);
      void runDirectSemanticForTurn({
        liveSessionId: sessionId,
        turn: input.turn,
        send: getVoiceV3LiveSend(sessionId) ?? null,
        reason: "caller_turn_committed",
      });
    }, DIRECT_SEMANTIC_DEFER_MS),
  );
}

export async function runDirectSemanticForTurn(input: {
  liveSessionId: string;
  turn: CallerTurn;
  send: ((event: { type: string; [key: string]: unknown }) => void) | null;
  reason: string;
}): Promise<boolean> {
  const sessionId = input.liveSessionId.trim();
  if (!input.send) return false;
  if (input.turn.status === "SEMANTIC_APPLIED") return false;
  if (directAttemptByTurn.has(input.turn.turnId)) return false;
  directAttemptByTurn.add(input.turn.turnId);

  const runtime = getVoiceV3CallRuntime(sessionId);
  if (!runtime) return false;

  const utterance = input.turn.transcript.trim();
  if (!utterance) {
    markCallerTurnSemanticFailed(sessionId, input.turn.turnId);
    return false;
  }

  const coordinator = getVoiceV3LiveResponseCoordinator(sessionId, input.send);
  if (coordinator.hasPendingFunctionOutputs() || coordinator.hasOpenDelegationAwaitingTool()) {
    return false;
  }

  markSemanticInterpretationStarted(sessionId);
  markCallerTurnSemanticRunning(sessionId, input.turn.turnId);
  const stateVersionBefore = runtime.getSnapshot().runtime.version;

  console.log("SEMANTIC_TURN_STARTED", {
    live_session_id: sessionId,
    turn_id: input.turn.turnId,
    turn_sequence: input.turn.sequence,
    reason: input.reason,
    state_version: stateVersionBefore,
  });

  let meaning = null;
  try {
    meaning = await runDirectCallerMeaningExtraction({
      runtime,
      liveSessionId: sessionId,
      callerUtterance: utterance,
      attemptId: `direct_${input.turn.turnId}`,
    });
  } catch (err) {
    console.log("SEMANTIC_TURN_FAILED", {
      live_session_id: sessionId,
      turn_id: input.turn.turnId,
      reason: "runner_threw",
      err,
    });
    markCallerTurnSemanticFailed(sessionId, input.turn.turnId);
    markSemanticInterpretationEnded(sessionId);
    return false;
  }

  if (!meaning) {
    markCallerTurnSemanticFailed(sessionId, input.turn.turnId);
    markSemanticInterpretationEnded(sessionId);
    return false;
  }

  if (!claimCallerMeaningFingerprint(sessionId, JSON.stringify(meaning))) {
    markSemanticInterpretationEnded(sessionId);
    return false;
  }

  const stateVersionAfterApply = runtime.getSnapshot().runtime.version;
  if (stateVersionAfterApply < stateVersionBefore) {
    console.log("SEMANTIC_RESULT_STALE", {
      live_session_id: sessionId,
      turn_id: input.turn.turnId,
    });
    markSemanticInterpretationEnded(sessionId);
    return false;
  }

  await applyExtractedCallerMeaning({
    runtime,
    liveSessionId: sessionId,
    meaning,
    transport: "function_tool",
    send: input.send,
    source: "semantic_retry",
  });

  markCallerTurnSemanticApplied(sessionId, input.turn.turnId);
  markSemanticInterpretationEnded(sessionId);
  return true;
}

export function clearSemanticTurnWatchdog(liveSessionId: string): void {
  const id = liveSessionId.trim();
  semanticInFlight.delete(id);
  const t = directTimers.get(id);
  if (t) clearTimeout(t);
  directTimers.delete(id);
  for (const key of directAttemptByTurn) {
    if (key.includes(id)) directAttemptByTurn.delete(key);
  }
}

/** After delegation closes, drain queued committed turns. */
export function drainQueuedSemanticTurns(input: {
  liveSessionId: string;
  send: (event: { type: string; [key: string]: unknown }) => void;
}): void {
  const runtime = getVoiceV3CallRuntime(input.liveSessionId);
  if (!runtime) return;
  const turn = getLatestCommittedCallerTurn(input.liveSessionId);
  if (!turn || turn.status !== "COMMITTED") return;
  void runDirectSemanticForTurn({
    liveSessionId: input.liveSessionId,
    turn,
    send: input.send,
    reason: "delegation_drained",
  });
}
