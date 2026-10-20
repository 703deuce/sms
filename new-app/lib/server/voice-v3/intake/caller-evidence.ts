import {
  getCommittedTurnsSinceLastSemanticApply,
  getLatestCommittedCallerTurn,
} from "../conversation/caller-turn-manager";
import { getGreetingPhase } from "../greeting/greeting-turn";

const MIN_COMMITTED_CHARS = 2;

/**
 * Authoritative app-side evidence that the caller completed a turn worth semantic interpretation.
 * Does not rely on transcript.done (not in Live contract).
 */
export function hasCommittedCallerEvidenceForSemantic(liveSessionId: string): boolean {
  if (getCommittedTurnsSinceLastSemanticApply(liveSessionId) > 0) {
    return true;
  }
  const latest = getLatestCommittedCallerTurn(liveSessionId);
  if (!latest) return false;
  if (latest.status !== "COMMITTED" && latest.status !== "SEMANTIC_FAILED") {
    return false;
  }
  return latest.transcript.trim().length >= MIN_COMMITTED_CHARS;
}

export function getCallerEvidenceCharCount(liveSessionId: string): number {
  const latest = getLatestCommittedCallerTurn(liveSessionId);
  if (latest?.transcript.trim()) {
    return latest.transcript.trim().length;
  }
  return 0;
}

export function getCallerEvidenceTurnId(liveSessionId: string): string | null {
  const latest = getLatestCommittedCallerTurn(liveSessionId);
  return latest?.turnId ?? null;
}

export function greetingPhaseForSemanticLog(liveSessionId: string): string {
  return getGreetingPhase(liveSessionId);
}
