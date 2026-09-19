import {
  appendCallerTranscriptFragment,
  commitCallerTranscriptSegment,
  getLastCallerTranscriptActivityAt,
  getRollingCallerTranscript,
  clearTranscriptAccumulator,
} from "./transcript-accumulator";
import { onCallerTurnCommitted } from "./delegation-timing";
import { ensureTurnProgressCommitted } from "./caller-turn-semantic-progress";
import {
  mergeCapturingTranscriptTimingIntoTurn,
  noteCallerTurnTimingCommitted,
  noteCallerTranscriptFragmentTiming,
} from "../telemetry/caller-turn-timing";

export type CallerTurnStatus =
  | "CAPTURING"
  | "COMMITTED"
  | "SEMANTIC_PENDING"
  | "SEMANTIC_RUNNING"
  | "SEMANTIC_APPLIED"
  | "SEMANTIC_FAILED"
  | "RECOVERY_REQUIRED"
  | "SUPERSEDED";

export type CallerTurn = {
  turnId: string;
  sequence: number;
  status: CallerTurnStatus;
  transcript: string;
  startedAt: string;
  committedAt?: string;
  semanticAttempt: number;
  stateVersionAtCommit?: number;
};

type SessionTurnState = {
  sequence: number;
  partial: string;
  turns: CallerTurn[];
  commitTimer: ReturnType<typeof setTimeout> | null;
  lastCommittedFingerprint: string;
  lastSemanticAppliedSequence: number;
};

const COMMIT_QUIET_MS = 750;
const MIN_MEANINGFUL_CHARS = 2;

const sessions = new Map<string, SessionTurnState>();

function state(liveSessionId: string): SessionTurnState {
  const id = liveSessionId.trim();
  let s = sessions.get(id);
  if (!s) {
    s = {
      sequence: 0,
      partial: "",
      turns: [],
      commitTimer: null,
      lastCommittedFingerprint: "",
      lastSemanticAppliedSequence: 0,
    };
    sessions.set(id, s);
  }
  return s;
}

export function noteCallerTranscriptDelta(liveSessionId: string, delta: string): void {
  const id = liveSessionId.trim();
  if (!id || !delta) return;
  const s = state(id);
  s.partial += delta;
  appendCallerTranscriptFragment(id, delta);
  noteCallerTranscriptFragmentTiming(id);

  if (s.commitTimer) {
    clearTimeout(s.commitTimer);
  }
  s.commitTimer = setTimeout(() => {
    s.commitTimer = null;
    void commitCapturingTurn(id);
  }, COMMIT_QUIET_MS);
}

/** LiveKit final transcript → committed caller turn (conversation revision). */
export function commitFinalCallerUtterance(
  liveSessionId: string,
  utterance: string,
): CallerTurn | null {
  const id = liveSessionId.trim();
  const s = state(id);
  if (s.commitTimer) {
    clearTimeout(s.commitTimer);
    s.commitTimer = null;
  }
  s.partial = utterance.trim();
  return commitCapturingTurn(id);
}

/** Force commit (e.g. when Live starts a delegation). */
export function forceCommitCallerTurn(liveSessionId: string): CallerTurn | null {
  const id = liveSessionId.trim();
  const s = state(id);
  if (s.commitTimer) {
    clearTimeout(s.commitTimer);
    s.commitTimer = null;
  }
  return commitCapturingTurn(id);
}

function commitCapturingTurn(liveSessionId: string): CallerTurn | null {
  const s = state(liveSessionId);
  const segment = s.partial.trim();
  s.partial = "";
  if (segment.length < MIN_MEANINGFUL_CHARS) {
    return null;
  }

  const fingerprint = segment.toLowerCase();
  if (fingerprint === s.lastCommittedFingerprint) {
    return null;
  }
  s.lastCommittedFingerprint = fingerprint;

  s.sequence += 1;
  commitCallerTranscriptSegment(liveSessionId, segment);
  const turn: CallerTurn = {
    turnId: `turn_${liveSessionId}_${s.sequence}`,
    sequence: s.sequence,
    status: "COMMITTED",
    transcript: segment,
    startedAt: new Date().toISOString(),
    committedAt: new Date().toISOString(),
    semanticAttempt: 0,
  };
  s.turns.push(turn);
  if (s.turns.length > 32) {
    s.turns.splice(0, s.turns.length - 32);
  }

  console.log("CALLER_TURN_COMMITTED", {
    live_session_id: liveSessionId,
    turn_id: turn.turnId,
    turn_sequence: turn.sequence,
    transcript_chars: segment.length,
    rolling_transcript_chars: getRollingCallerTranscript(liveSessionId).length,
  });

  noteCallerTurnTimingCommitted({
    liveSessionId,
    turnId: turn.turnId,
    turnSequence: turn.sequence,
  });
  mergeCapturingTranscriptTimingIntoTurn(liveSessionId, turn.turnId);
  ensureTurnProgressCommitted(liveSessionId, turn);

  queueMicrotask(() => {
    onCallerTurnCommitted({
      liveSessionId,
      turn,
      rollingTranscript: getRollingCallerTranscript(liveSessionId),
    });
  });

  return turn;
}

export function markCallerTurnSemanticRunning(liveSessionId: string, turnId: string): void {
  const t = state(liveSessionId).turns.find((r) => r.turnId === turnId);
  if (t) t.status = "SEMANTIC_RUNNING";
}

export function markCallerTurnSemanticApplied(liveSessionId: string, turnId: string): void {
  const s = state(liveSessionId);
  const t = s.turns.find((r) => r.turnId === turnId);
  if (t) {
    t.status = "SEMANTIC_APPLIED";
    s.lastSemanticAppliedSequence = t.sequence;
  }
  console.log("SEMANTIC_TURN_APPLIED", {
    live_session_id: liveSessionId,
    turn_id: turnId,
    turn_sequence: t?.sequence,
  });
}

export function markCallerTurnSemanticFailed(liveSessionId: string, turnId: string): void {
  const t = state(liveSessionId).turns.find((r) => r.turnId === turnId);
  if (t) t.status = "SEMANTIC_FAILED";
}

export function getCallerTurns(liveSessionId: string): CallerTurn[] {
  return [...state(liveSessionId).turns];
}

export function getCommittedTurnsSinceLastSemanticApply(liveSessionId: string): number {
  const s = state(liveSessionId);
  return s.turns.filter((t) => t.sequence > s.lastSemanticAppliedSequence && t.status === "COMMITTED")
    .length;
}

export function getLatestCommittedCallerTurn(liveSessionId: string): CallerTurn | null {
  const turns = state(liveSessionId).turns;
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.status === "COMMITTED" || t.status === "SEMANTIC_FAILED") {
      return t;
    }
  }
  return turns[turns.length - 1] ?? null;
}

export function getCallerEvidenceForSemanticRetry(liveSessionId: string): string {
  const latest = getLatestCommittedCallerTurn(liveSessionId);
  if (latest?.transcript.trim()) {
    return latest.transcript.trim();
  }
  return getRollingCallerTranscript(liveSessionId);
}

export function clearCallerTurnManager(liveSessionId: string): void {
  const id = liveSessionId.trim();
  const s = sessions.get(id);
  if (s?.commitTimer) {
    clearTimeout(s.commitTimer);
  }
  sessions.delete(id);
  clearTranscriptAccumulator(id);
}

export function getLastCallerTranscriptQuietMs(liveSessionId: string): number | null {
  const at = getLastCallerTranscriptActivityAt(liveSessionId);
  if (!at) return null;
  return Date.now() - at;
}
