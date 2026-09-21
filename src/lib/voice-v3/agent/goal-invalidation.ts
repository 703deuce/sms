import type { VoiceV3CallContext } from "../state/call-context";

/** Invalidate booking-specific state when abandoning BOOK — preserve intake facts. */
export function invalidateBookingStateForGoalAbandon(ctx: VoiceV3CallContext): VoiceV3CallContext {
  return {
    ...ctx,
    availability: {
      status: "idle",
      activeOfferSet: null,
      lastFailure: null,
      inFlightGeneration: null,
      lastDispatchedRequestKey: null,
      findStartedAt: null,
    },
    presentation: { current: null },
    selection: { selected: null, lastResolutionStatus: null },
    booking: {
      phase: "NONE",
      activeAttempt: null,
      confirmed: ctx.booking.confirmed,
      lastFailure: null,
      postBookChangeRequested: false,
      verbalConfirmation: "NOT_REQUIRED",
    },
    runtime: { version: ctx.runtime.version + 1 },
  };
}
