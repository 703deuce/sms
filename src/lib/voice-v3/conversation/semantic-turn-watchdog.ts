/**
 * @deprecated Import from `./delegation-timing` instead.
 * Re-exports delegation timing helpers only — no conversational authority.
 */
export {
  cancelDirectSemanticDefer,
  cancelSemanticStallBreakerForTurn,
  clearDelegationTimingState,
  clearSemanticTurnWatchdog,
  isSemanticInterpretationInFlight,
  markSemanticInterpretationEnded,
  markSemanticInterpretationStarted,
  onCallerTurnCommitted,
} from "./delegation-timing";
