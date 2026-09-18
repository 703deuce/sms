import type { VoiceV3CallContext } from "../state/call-context";
import type { AgentClaim } from "./conversation-action";
import { deriveAsyncOperations, findRunningOperation } from "./async-operations";

export interface ClaimsEvaluation {
  allowed: AgentClaim[];
  forbidden: AgentClaim[];
}

export function evaluateAllowedClaims(ctx: VoiceV3CallContext): ClaimsEvaluation {
  const ops = deriveAsyncOperations(ctx);
  const allowed: AgentClaim[] = [];
  let forbidden: AgentClaim[] = [
    "CLAIM_BOOKED",
    "CLAIM_RESCHEDULED",
    "CLAIM_CANCELLED",
  ];

  const findRunning = findRunningOperation(ops, "FIND_AVAILABILITY");
  if (findRunning) {
    allowed.push("CLAIM_CHECKING_AVAILABILITY");
  } else {
    forbidden.push("CLAIM_CHECKING_AVAILABILITY");
  }

  const offer = ctx.availability.activeOfferSet;
  if (offer && ctx.availability.status === "ready" && offer.slots.length > 0) {
    allowed.push("PRESENT_AVAILABILITY");
  } else {
    forbidden.push("PRESENT_AVAILABILITY");
  }

  const bookRunning = ops.some(
    (o) =>
      o.type === "BOOK_APPOINTMENT" &&
      (o.status === "RUNNING" || o.status === "OUTCOME_UNKNOWN"),
  );
  if (bookRunning) {
    allowed.push("CLAIM_BOOKING_IN_PROGRESS");
    forbidden.push("CLAIM_BOOKED");
  }

  if (ctx.booking.phase === "BOOKING_CONFIRMED" && ctx.booking.confirmed) {
    allowed.push("CLAIM_BOOKED");
    forbidden = forbidden.filter((c) => c !== "CLAIM_BOOKED");
  }

  const rescheduleRunning = ops.some(
    (o) => o.type === "RESCHEDULE_APPOINTMENT" && o.status === "RUNNING",
  );
  if (rescheduleRunning) {
    allowed.push("CLAIM_RESCHEDULING_IN_PROGRESS");
  }

  const cancelRunning = ops.some(
    (o) => o.type === "CANCEL_APPOINTMENT" && o.status === "RUNNING",
  );
  if (cancelRunning) {
    allowed.push("CLAIM_CANCELLING_IN_PROGRESS");
  }

  if (ctx.appointmentManagement.cancellation.phase === "CANCELLATION_CONFIRMED") {
    allowed.push("CLAIM_CANCELLED");
    forbidden = forbidden.filter((c) => c !== "CLAIM_CANCELLED");
  }

  return { allowed, forbidden };
}
