import type { VoiceV3Goal } from "../state/call-context";
import type { AgentClaim } from "../agent/conversation-action";
import type { VoiceOperationName } from "../intake-objective/operation-requirements";

export type VoiceIntentProfile = {
  operation: VoiceOperationName;
  activeGoal: VoiceV3Goal;
  /** Primary tool(s) that establish or advance this intent. */
  primaryTools: string[];
  /** Claims the planner may allow when runtime preconditions are met (not exhaustive). */
  allowedClaimsWhenReady: AgentClaim[];
  /** Claims that must stay forbidden until backend proof exists. */
  forbiddenUntilProof: AgentClaim[];
};

/**
 * Authoritative map: operation → dialog goal → tools → claim policy (planner enforces at runtime).
 * Used by get_intake_state operation overrides and multi-intent switching tests.
 */
export const VOICE_OPERATION_INTENT_CATALOG: VoiceIntentProfile[] = [
  {
    operation: "send_booking_link",
    activeGoal: "BOOK_APPOINTMENT",
    primaryTools: ["get_intake_state", "update_intake", "send_booking_link"],
    allowedClaimsWhenReady: ["CLAIM_BOOKING_LINK_SENT"],
    forbiddenUntilProof: ["CLAIM_BOOKED", "CLAIM_BOOKING_LINK_SENT"],
  },
  {
    operation: "book_appointment",
    activeGoal: "BOOK_APPOINTMENT",
    primaryTools: ["book_appointment", "find_availability", "set_scheduling_preference"],
    allowedClaimsWhenReady: ["CLAIM_CHECKING_AVAILABILITY", "PRESENT_AVAILABILITY", "CLAIM_BOOKING_IN_PROGRESS", "CLAIM_BOOKED"],
    forbiddenUntilProof: ["CLAIM_BOOKED", "CLAIM_BOOKING_LINK_SENT"],
  },
  {
    operation: "find_availability",
    activeGoal: "BOOK_APPOINTMENT",
    primaryTools: ["find_availability"],
    allowedClaimsWhenReady: ["CLAIM_CHECKING_AVAILABILITY", "PRESENT_AVAILABILITY"],
    forbiddenUntilProof: ["CLAIM_BOOKED", "CLAIM_BOOKING_LINK_SENT"],
  },
  {
    operation: "find_appointment",
    activeGoal: "RESCHEDULE_APPOINTMENT",
    primaryTools: ["find_appointment"],
    allowedClaimsWhenReady: [],
    forbiddenUntilProof: ["CLAIM_RESCHEDULED", "CLAIM_CANCELLED", "CLAIM_BOOKED"],
  },
  {
    operation: "reschedule_appointment",
    activeGoal: "RESCHEDULE_APPOINTMENT",
    primaryTools: ["reschedule_appointment", "find_appointment", "find_availability"],
    allowedClaimsWhenReady: ["CLAIM_RESCHEDULING_IN_PROGRESS", "CLAIM_RESCHEDULED"],
    forbiddenUntilProof: ["CLAIM_RESCHEDULED", "CLAIM_CANCELLED"],
  },
  {
    operation: "cancel_appointment",
    activeGoal: "CANCEL_APPOINTMENT",
    primaryTools: ["cancel_appointment", "find_appointment"],
    allowedClaimsWhenReady: ["CLAIM_CANCELLING_IN_PROGRESS", "CLAIM_CANCELLED"],
    forbiddenUntilProof: ["CLAIM_CANCELLED", "CLAIM_RESCHEDULED"],
  },
  {
    operation: "request_callback",
    activeGoal: "REQUEST_CALLBACK",
    primaryTools: ["request_callback", "get_intake_state", "update_intake"],
    allowedClaimsWhenReady: [],
    forbiddenUntilProof: ["CLAIM_BOOKED", "CLAIM_BOOKING_LINK_SENT"],
  },
  {
    operation: "take_message",
    activeGoal: "TAKE_MESSAGE",
    primaryTools: ["take_message"],
    allowedClaimsWhenReady: [],
    forbiddenUntilProof: ["CLAIM_BOOKED", "CLAIM_BOOKING_LINK_SENT"],
  },
  {
    operation: "transfer_call",
    activeGoal: "REQUEST_TRANSFER",
    primaryTools: ["transfer_call"],
    allowedClaimsWhenReady: [],
    forbiddenUntilProof: ["CLAIM_BOOKED", "CLAIM_BOOKING_LINK_SENT"],
  },
  {
    operation: "search_business_knowledge",
    activeGoal: "GENERAL",
    primaryTools: ["search_business_knowledge"],
    allowedClaimsWhenReady: [],
    forbiddenUntilProof: ["CLAIM_BOOKED", "CLAIM_BOOKING_LINK_SENT", "CLAIM_RESCHEDULED", "CLAIM_CANCELLED"],
  },
];

const byOperation = new Map<VoiceOperationName, VoiceIntentProfile>(
  VOICE_OPERATION_INTENT_CATALOG.map((row) => [row.operation, row]),
);

export function getVoiceIntentProfile(operation: VoiceOperationName): VoiceIntentProfile | null {
  return byOperation.get(operation) ?? null;
}

/** Operations get_intake_state may accept to re-target active goal mid-call. */
export const GET_INTAKE_STATE_OPERATIONS: VoiceOperationName[] = [
  "send_booking_link",
  "book_appointment",
  "find_availability",
  "find_appointment",
  "reschedule_appointment",
  "cancel_appointment",
  "request_callback",
  "take_message",
  "transfer_call",
  "search_business_knowledge",
];

export function listVoiceIntentSummaryForReport(): string[] {
  return VOICE_OPERATION_INTENT_CATALOG.map(
    (r) =>
      `${r.operation} → ${r.activeGoal} | tools: ${r.primaryTools.join(", ")} | forbid until proof: ${r.forbiddenUntilProof.join(", ") || "(none)"}`,
  );
}
