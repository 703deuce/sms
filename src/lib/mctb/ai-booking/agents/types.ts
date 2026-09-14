export type IntentRouterIntent =
  | "SCHEDULING"
  | "PAYMENT"
  | "GENERAL_CONVERSATION"
  | "CALLBACK_REQUEST"
  | "HUMAN_HANDOFF"
  | "UNKNOWN";

export type SchedulingSubintent =
  | "CHECK_AVAILABILITY"
  | "BOOK_SLOT"
  | "CHANGE_TIME_PREFERENCE"
  | "CANCEL_BOOKING"
  | "RESCHEDULE"
  | "ASK_BOOKING_LINK"
  | "UNKNOWN_SCHEDULING";

export type IntentRouterResult = {
  intent: IntentRouterIntent;
  confidence: number;
  subintent?: SchedulingSubintent | null;
  needs_clarification: boolean;
};

export type SchedulingSpecialistAction =
  | "CHECK_AVAILABILITY"
  | "CHECK_SPECIFIC_TIME"
  | "SELECT_OFFERED_SLOT"
  | "ASK_CLARIFICATION"
  | "CONFIRM_BOOKING";

export type SchedulingSpecialistResult = {
  action: SchedulingSpecialistAction;
  window_start?: string | null;
  window_end?: string | null;
  requested_start?: string | null;
  preferred_time?: string | null;
  offered_slot_id?: string | null;
  /** 1-based index into persisted offered_slots when slot id omitted */
  offered_slot_index?: number | null;
  timezone: string;
  needs_clarification: boolean;
  question_type?: string | null;
  clarification_text?: string | null;
  /** Semantic confirmation — orchestrator must not parse raw SMS for yes/works. */
  customer_confirms_booking?: boolean;
  customer_rejects_selection?: boolean;
  is_correction?: boolean;
  /** Semantic local date (YYYY-MM-DD) — runtime converts to UTC windows. */
  requested_local_date?: string | null;
  requested_local_time?: string | null;
  time_relation?: "AT" | "AFTER" | "BEFORE" | "AROUND" | null;
  daypart?: "MORNING" | "AFTERNOON" | "EVENING" | null;
  time_specificity?: "EXACT" | "DAYPART" | "DATE_ONLY" | null;
};

export const ROUTER_CONFIDENCE_THRESHOLD = 0.72;
