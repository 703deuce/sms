/** Runtime-owned conversational need — Live chooses natural wording. */
export type ConversationAction =
  | { type: "ASK_REQUIRED_FIELD"; fieldKey: string }
  | { type: "ASK_SCHEDULING_DATE" }
  | { type: "ASK_SCHEDULING_TIME" }
  | { type: "CLARIFY_SCHEDULING"; reason: string }
  | { type: "PRESENT_AVAILABILITY"; offerSetId: string }
  | { type: "CLARIFY_SLOT_SELECTION" }
  | { type: "CONFIRM_CANCELLATION"; attemptId?: string }
  | { type: "VERIFY_CALLER"; verificationId?: string }
  | { type: "ACKNOWLEDGE_PENDING_ACTION"; operationId: string }
  | { type: "INFORM_RESULT"; resultType: string }
  | { type: "INFORM_TEMPORARY_FAILURE"; failureCode: string }
  | { type: "OFFER_HANDOFF"; reason: string }
  | { type: "ASK_ANYTHING_ELSE" }
  | { type: "END_CALL" }
  | { type: "NONE" };

export type AgentClaim =
  | "CLAIM_CHECKING_AVAILABILITY"
  | "PRESENT_AVAILABILITY"
  | "CLAIM_BOOKING_IN_PROGRESS"
  | "CLAIM_BOOKED"
  | "CLAIM_RESCHEDULED"
  | "CLAIM_CANCELLED"
  | "CLAIM_RESCHEDULING_IN_PROGRESS"
  | "CLAIM_CANCELLING_IN_PROGRESS";

export type BackendActionKind =
  | "FIND_AVAILABILITY"
  | "BOOK_APPOINTMENT"
  | "RESCHEDULE_APPOINTMENT"
  | "CANCEL_APPOINTMENT"
  | "FIND_EXISTING_APPOINTMENT"
  | "REVALIDATE_SLOT"
  | "SEMANTIC_EXTRACTION"
  | "TRANSFER"
  | "CALLBACK";

export type AsyncOperationStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "OUTCOME_UNKNOWN"
  | "CANCELLED"
  | "STALE";

export type AgentBlockerCode = string;

export interface AgentBlocker {
  code: AgentBlockerCode;
  recoveryCategory:
    | "MISSING_INFORMATION"
    | "CLARIFICATION"
    | "INTERNAL_FAILURE"
    | "EXTERNAL_FAILURE"
    | "CONFLICT"
    | "VERIFICATION"
    | "DESTRUCTIVE_CONFIRMATION";
  userRecoverable: boolean;
}
