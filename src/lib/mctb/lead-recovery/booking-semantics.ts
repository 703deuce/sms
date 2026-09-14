import type { LeadRecoveryBookingDisposition, StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";

const DISPOSITIONS = new Set<LeadRecoveryBookingDisposition>([
  "NONE",
  "CHECK_AVAILABILITY",
  "REQUEST_BOOKING",
  "SELECT_SLOT",
  "CONFIRM_BOOKING",
  "MODIFY_REQUEST",
  "CANCEL_REQUEST",
]);

export function parseBookingDisposition(raw: unknown): LeadRecoveryBookingDisposition {
  const v = String(raw || "NONE")
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (DISPOSITIONS.has(v as LeadRecoveryBookingDisposition)) {
    return v as LeadRecoveryBookingDisposition;
  }
  return "NONE";
}

export function defaultBookingDispositionForIntent(
  primary: StructuredLeadIntent["primary_intent"],
): LeadRecoveryBookingDisposition {
  if (primary === "BOOKING_REQUEST" || primary === "SPECIFIC_TIME_REQUEST") {
    return "REQUEST_BOOKING";
  }
  if (primary === "AVAILABILITY_QUESTION") {
    return "CHECK_AVAILABILITY";
  }
  return "NONE";
}

const SCHEDULING_PRIMARY_INTENTS = new Set<StructuredLeadIntent["primary_intent"]>([
  "AVAILABILITY_QUESTION",
  "BOOKING_REQUEST",
  "SPECIFIC_TIME_REQUEST",
  "RESCHEDULE_REQUEST",
]);

/**
 * Whether Lead Recovery may execute the AI_BOOK action (enter AI scheduling workflow).
 *
 * AI_BOOK ≠ customer authorization to CREATE_BOOKING. The orchestrator only writes after
 * explicit confirmation/selection policy. This gate only permits scheduling specialist +
 * provider READ (and later WRITE when authorized).
 */
export function intentPermitsAiBook(intent: StructuredLeadIntent): boolean {
  const disposition =
    intent.booking_disposition ?? defaultBookingDispositionForIntent(intent.primary_intent);

  if (disposition === "CANCEL_REQUEST") {
    return false;
  }

  if (disposition === "CHECK_AVAILABILITY") {
    return SCHEDULING_PRIMARY_INTENTS.has(intent.primary_intent);
  }

  if (
    disposition === "REQUEST_BOOKING" ||
    disposition === "CONFIRM_BOOKING" ||
    disposition === "SELECT_SLOT" ||
    disposition === "MODIFY_REQUEST"
  ) {
    return true;
  }

  if (intent.primary_intent === "BOOKING_REQUEST") {
    return disposition !== "NONE";
  }

  if (intent.primary_intent === "SPECIFIC_TIME_REQUEST") {
    return disposition !== "NONE" && disposition !== "CANCEL_REQUEST";
  }

  if (intent.primary_intent === "RESCHEDULE_REQUEST") {
    return disposition !== "NONE" && disposition !== "CANCEL_REQUEST";
  }

  return false;
}

/** @deprecated use intentPermitsAiBook — same scheduling-workflow gate */
export function intentPermitsSchedulingWorkflow(intent: StructuredLeadIntent): boolean {
  return intentPermitsAiBook(intent);
}
