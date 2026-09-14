import type { LeadRecoveryStopScope, StructuredLeadIntent } from "@/lib/mctb/lead-recovery/types";
import type { MctbStructuredConversationState } from "@/lib/mctb/semantic-conversation-context";

export type IntentSemanticContradiction =
  | "CANCEL_PRIMARY_WITH_KEEP_WORKFLOW"
  | "OPT_OUT_WITH_KEEP_MESSAGING"
  | "BOOKING_DISPOSITION_WITHOUT_BOOKING"
  | "PAYMENT_PRIMARY_WITHOUT_PAYMENT_INTENT"
  | "OPT_OUT_WITH_WORKFLOW_STOP_SCOPE";

export function validateStructuredIntentConsistency(
  intent: StructuredLeadIntent,
): IntentSemanticContradiction[] {
  const issues: IntentSemanticContradiction[] = [];
  const updates = intent.workflow_updates ?? [];

  const keepBooking = updates.some(
    (w) =>
      w.instruction === "KEEP" &&
      (w.target === "PENDING_BOOKING" || w.target === "ALL_PENDING"),
  );
  const keepPayment = updates.some(
    (w) =>
      w.instruction === "KEEP" &&
      (w.target === "PENDING_PAYMENT" || w.target === "ALL_PENDING"),
  );

  if (keepBooking && intent.primary_intent === "CANCEL_REQUEST") {
    issues.push("CANCEL_PRIMARY_WITH_KEEP_WORKFLOW");
  }

  if (
    intent.primary_intent === "OPT_OUT" &&
    (keepBooking || keepPayment) &&
    intent.stop_scope !== "GLOBAL_MESSAGING"
  ) {
    issues.push("OPT_OUT_WITH_KEEP_MESSAGING");
  }

  if (
    intent.primary_intent === "OPT_OUT" &&
    intent.stop_scope &&
    intent.stop_scope !== "GLOBAL_MESSAGING"
  ) {
    issues.push("OPT_OUT_WITH_WORKFLOW_STOP_SCOPE");
  }

  if (
    !intent.booking_requested &&
    (intent.booking_disposition === "REQUEST_BOOKING" ||
      intent.booking_disposition === "CONFIRM_BOOKING") &&
    !intent.needs_clarification
  ) {
    issues.push("BOOKING_DISPOSITION_WITHOUT_BOOKING");
  }

  if (intent.primary_intent === "PAYMENT_REQUEST" && !intent.payment_intent && !intent.needs_clarification) {
    issues.push("PAYMENT_PRIMARY_WITHOUT_PAYMENT_INTENT");
  }

  return issues;
}

/**
 * Resolve contradictions using structured fields only (workflow_updates / stop_scope win over conflicting primary).
 * Not customer-message keyword routing.
 */
export function reconcileStructuredIntentConsistency(
  intent: StructuredLeadIntent,
): StructuredLeadIntent {
  let next = { ...intent, workflow_updates: [...(intent.workflow_updates ?? [])] };
  const issues = validateStructuredIntentConsistency(next);
  if (!issues.length) return next;

  if (issues.includes("CANCEL_PRIMARY_WITH_KEEP_WORKFLOW")) {
    next = {
      ...next,
      primary_intent: "GENERAL_INQUIRY",
      booking_disposition: "NONE",
      booking_requested: false,
    };
  }

  if (issues.includes("OPT_OUT_WITH_WORKFLOW_STOP_SCOPE")) {
    next = {
      ...next,
      primary_intent: "GENERAL_INQUIRY",
    };
  }

  if (issues.includes("OPT_OUT_WITH_KEEP_MESSAGING")) {
    next = {
      ...next,
      primary_intent: "GENERAL_INQUIRY",
    };
  }

  if (issues.includes("BOOKING_DISPOSITION_WITHOUT_BOOKING")) {
    next = {
      ...next,
      booking_disposition: "NONE",
    };
  }

  if (issues.includes("PAYMENT_PRIMARY_WITHOUT_PAYMENT_INTENT")) {
    next = {
      ...next,
      primary_intent: "GENERAL_INQUIRY",
    };
  }

  return next;
}

export const INTENT_CONSISTENCY_REPAIR_HINT =
  "Your structured output is internally inconsistent. Return ONE coherent interpretation. " +
  "If workflow_updates says KEEP for PENDING_BOOKING because the customer negated cancellation, " +
  "primary_intent MUST NOT be CANCEL_REQUEST. " +
  "If the customer is stopping a current booking search (not all SMS), use stop_scope BOOKING or CURRENT_WORKFLOW, not OPT_OUT. " +
  "Global SMS opt-out requires clear withdrawal of consent to message (e.g. stop texting me), not a bare 'Stop' answering a booking question.";

/**
 * When structured_state shows an in-flight workflow, bare OPT_OUT without GLOBAL_MESSAGING
 * is usually a workflow stop mislabeled — resolve using runtime state, not customer-message keywords.
 */
export function reconcileIntentWithStructuredState(
  intent: StructuredLeadIntent,
  structured: MctbStructuredConversationState | null | undefined,
): StructuredLeadIntent {
  if (!structured || intent.primary_intent !== "OPT_OUT") return intent;
  if (intent.stop_scope === "GLOBAL_MESSAGING") return intent;

  const workflow = structured.active_workflow;
  const pending = structured.pending_action;

  const inBooking =
    workflow === "BOOKING" ||
    pending === "AI_BOOK" ||
    pending === "SEND_BOOKING_LINK" ||
    structured.booking_session_active;
  const inPayment = workflow === "PAYMENT" || pending === "SEND_TEXT_TO_PAY";
  const inCallback = workflow === "CALLBACK" || pending === "CREATE_CALLBACK_REQUEST";

  if (!inBooking && !inPayment && !inCallback) return intent;

  let stop_scope: LeadRecoveryStopScope = intent.stop_scope ?? "UNKNOWN";
  if (inPayment && !inBooking) stop_scope = "PAYMENT";
  else if (inCallback && !inBooking && !inPayment) stop_scope = "CALLBACK";
  else stop_scope = "BOOKING";

  const workflow_updates = [...(intent.workflow_updates ?? [])];
  const hasCancel = workflow_updates.some((w) => w.instruction === "CANCEL");
  if (!hasCancel) {
    if (stop_scope === "PAYMENT") {
      workflow_updates.push({ target: "PENDING_PAYMENT", instruction: "CANCEL" });
    } else if (stop_scope === "CALLBACK") {
      workflow_updates.push({ target: "PENDING_CALLBACK", instruction: "CANCEL" });
    } else {
      workflow_updates.push({ target: "PENDING_BOOKING", instruction: "CANCEL" });
    }
  }

  return {
    ...intent,
    primary_intent: "GENERAL_INQUIRY",
    stop_scope,
    workflow_updates,
  };
}

export function parseStopScope(raw: unknown): LeadRecoveryStopScope | null {
  const v = String(raw || "").toUpperCase();
  const allowed: LeadRecoveryStopScope[] = [
    "GLOBAL_MESSAGING",
    "CURRENT_WORKFLOW",
    "BOOKING",
    "PAYMENT",
    "CALLBACK",
    "UNKNOWN",
  ];
  return allowed.includes(v as LeadRecoveryStopScope) ? (v as LeadRecoveryStopScope) : null;
}
