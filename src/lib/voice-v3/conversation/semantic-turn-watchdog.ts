/**
 * Delegation/tool timing helpers only — no direct semantic extraction or CallerMeaning gateway.
 */

const semanticInFlight = new Set<string>();

export function isSemanticInterpretationInFlight(liveSessionId: string): boolean {
  return semanticInFlight.has(liveSessionId.trim());
}

export function markSemanticInterpretationStarted(liveSessionId: string): void {
  semanticInFlight.add(liveSessionId.trim());
}

export function markSemanticInterpretationEnded(liveSessionId: string): void {
  semanticInFlight.delete(liveSessionId.trim());
}

/** Telemetry hook — GPT-Live owns turn semantics; no application extraction. */
export function onCallerTurnCommitted(_input: {
  liveSessionId: string;
  turn: { turnId: string };
  rollingTranscript: string;
}): void {
  // intentionally empty
}

export function cancelDirectSemanticDefer(_liveSessionId: string): void {}

export function cancelSemanticStallBreakerForTurn(_turnId: string): void {}

export function clearSemanticTurnWatchdog(liveSessionId: string): void {
  semanticInFlight.delete(liveSessionId.trim());
}
