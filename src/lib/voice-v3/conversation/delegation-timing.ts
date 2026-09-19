/**
 * Delegation/tool timing helpers only — no conversational authority.
 */

import { getCurrentConversationRevision, logConversationRevisionAdvanced } from "./conversation-revision";
import { peekVoiceV3LiveResponseCoordinator } from "../delegation/live-response-coordinator";

const semanticInFlight = new Set<string>();
const lastRevisionBySession = new Map<string, number>();

export function isSemanticInterpretationInFlight(liveSessionId: string): boolean {
  return semanticInFlight.has(liveSessionId.trim());
}

export function markSemanticInterpretationStarted(liveSessionId: string): void {
  semanticInFlight.add(liveSessionId.trim());
}

export function markSemanticInterpretationEnded(liveSessionId: string): void {
  semanticInFlight.delete(liveSessionId.trim());
}

/** O(1) revision bookkeeping — no LLM, no intent classification. */
export function onCallerTurnCommitted(input: {
  liveSessionId: string;
  turn: { turnId: string; sequence: number };
  rollingTranscript: string;
}): void {
  const id = input.liveSessionId.trim();
  const current = input.turn.sequence;
  const previous = lastRevisionBySession.get(id) ?? 0;
  lastRevisionBySession.set(id, current);
  logConversationRevisionAdvanced({
    liveSessionId: id,
    previousRevision: previous,
    currentRevision: current,
  });
  const coord = peekVoiceV3LiveResponseCoordinator(id);
  coord?.markDelegationsSemanticallyStale(current);
  if (coord && !coord.hasFreshDelegationAtRevision(current) && coord.hasAnySemanticallyStaleDelegation()) {
    console.log("FRESH_DELEGATION_GAP_AFTER_REVISION", {
      live_session_id: id,
      current_conversation_revision: current,
      note: "stale_delegation_exists_no_fresh_delegation_at_current_revision",
    });
  }
}

export function cancelDirectSemanticDefer(_liveSessionId: string): void {}

export function cancelSemanticStallBreakerForTurn(_turnId: string): void {}

export function clearDelegationTimingState(liveSessionId: string): void {
  const id = liveSessionId.trim();
  semanticInFlight.delete(id);
  lastRevisionBySession.delete(id);
}

/** @deprecated use clearDelegationTimingState */
export const clearSemanticTurnWatchdog = clearDelegationTimingState;
