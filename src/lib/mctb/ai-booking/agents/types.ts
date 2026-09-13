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
  timezone: string;
  needs_clarification: boolean;
  question_type?: string | null;
  clarification_text?: string | null;
};

export const ROUTER_CONFIDENCE_THRESHOLD = 0.72;
