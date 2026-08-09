import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import { legacyStateForNode } from "./node-transitions";
import { resolveNextNodeId } from "./node-transitions";
import type { WorkflowDefinition } from "./schema";
import {
  fieldsComplete,
  hasAvailableSlots,
  hasBookingReceipt,
  hasHeldSlot,
  missingRequiredFieldCount,
} from "./completion-guards";

/** Canonical progression view — currentNodeId is the single source of truth. */
export type CanonicalWorkflowState = {
  currentNodeId: string;
  /** Derived from currentNodeId — never written independently. */
  legacyState: WorkflowState;
  missingFieldIds: string[];
  readyForAvailability: boolean;
  bookingReceiptPresent: boolean;
  bookingInProgress: boolean;
  /** Runtime-computed next business action (not LLM-managed). */
  expectedNextAction: CanonicalNextAction;
};

export type CanonicalNextAction =
  | "collect_caller_information"
  | "check_availability"
  | "select_slot"
  | "confirm_booking"
  | "detect_intent"
  | "classify"
  | "validate_eligibility"
  | "find_appointments"
  | "reschedule_appointment"
  | "cancel_appointment"
  | "complete"
  | "converse";

function missingFieldIdsFromSession(session: AmyRealtimeSession): string[] {
  return session.fieldManifest
    .filter((field) => field.required && !session.collectedFields[field.field_id]?.trim())
    .map((field) => field.field_id);
}

function callerIntentFromSession(session: AmyRealtimeSession): string | null {
  return session.runtime?.session_runtime?.callerIntent ?? null;
}

const RESCHEDULE_FLOW_NODES = new Set([
  "reschedule_lookup",
  "check_availability",
  "select_slot",
  "confirm_booking",
]);

/**
 * Derive graph position from session facts (receipts, slots, fields).
 * Overrides stale cursors such as classify while a slot is held.
 */
export function deriveAuthoritativeNodeId(input: {
  session: AmyRealtimeSession;
  workflow: WorkflowDefinition;
  storedNodeId?: string | null;
}): string {
  const nodeIds = new Set(input.workflow.nodes.map((n) => n.id));
  const stored =
    input.storedNodeId && nodeIds.has(input.storedNodeId)
      ? input.storedNodeId
      : input.workflow.entryNodeId;

  if (hasBookingReceipt(input.session) && nodeIds.has("complete")) {
    return "complete";
  }

  const callerIntent = callerIntentFromSession(input.session);

  // Reschedule/cancel/emergency flows must not rewind to new-booking intake.
  if (callerIntent === "reschedule") {
    if (hasHeldSlot(input.session) && nodeIds.has("confirm_booking")) {
      return "confirm_booking";
    }
    if (
      hasAvailableSlots(input.session) &&
      !hasHeldSlot(input.session) &&
      nodeIds.has("select_slot")
    ) {
      return "select_slot";
    }
    if (
      !hasAvailableSlots(input.session) &&
      !hasHeldSlot(input.session) &&
      stored === "check_availability" &&
      nodeIds.has("check_availability")
    ) {
      return "check_availability";
    }
    if (RESCHEDULE_FLOW_NODES.has(stored)) return stored;
    if (nodeIds.has("reschedule_lookup")) return "reschedule_lookup";
  }

  if (callerIntent === "cancel") {
    if (stored === "cancel_confirm" && nodeIds.has("cancel_confirm")) {
      return "cancel_confirm";
    }
    if (stored === "cancel_lookup" && nodeIds.has("cancel_lookup")) {
      return "cancel_lookup";
    }
    if (nodeIds.has("cancel_lookup")) return "cancel_lookup";
  }

  if (callerIntent === "emergency") {
    if (stored === "transfer_fallback" && nodeIds.has("transfer_fallback")) {
      return "transfer_fallback";
    }
    if (nodeIds.has("emergency_handoff")) return "emergency_handoff";
  }

  // Scheduling phase wins over missing-field rewind — late fields are collected at confirmation.
  if (hasHeldSlot(input.session) && nodeIds.has("confirm_booking")) {
    return "confirm_booking";
  }

  if (
    hasAvailableSlots(input.session) &&
    !hasHeldSlot(input.session) &&
    nodeIds.has("select_slot")
  ) {
    return "select_slot";
  }

  const missing = missingRequiredFieldCount(input.session);
  if (missing > 0) {
    if (stored === "lookup_customer" || stored === "detect_intent") return stored;
    if (nodeIds.has("collect_fields")) return "collect_fields";
    return input.workflow.entryNodeId;
  }

  if (
    !hasAvailableSlots(input.session) &&
    !hasHeldSlot(input.session) &&
    nodeIds.has("check_availability")
  ) {
    return "check_availability";
  }

  if (nodeIds.has("classify")) return "classify";

  return stored;
}

function deriveExpectedNextAction(input: {
  nodeId: string;
  missingCount: number;
  hasSlots: boolean;
  hasHeldSlot: boolean;
  bookingReceiptPresent: boolean;
  callerIntent?: string | null;
}): CanonicalNextAction {
  if (input.bookingReceiptPresent || input.nodeId === "complete") return "complete";

  if (input.nodeId === "reschedule_lookup") return "find_appointments";
  if (input.nodeId === "cancel_lookup") return "find_appointments";
  if (input.nodeId === "cancel_confirm") return "cancel_appointment";

  if (input.nodeId === "confirm_booking") {
    if (input.callerIntent === "reschedule") return "reschedule_appointment";
    if (input.callerIntent === "cancel") return "cancel_appointment";
    return "confirm_booking";
  }

  if (input.nodeId === "select_slot") {
    return input.hasHeldSlot ? "confirm_booking" : "select_slot";
  }

  if (input.nodeId === "check_availability") return "check_availability";

  if (input.missingCount > 0) return "collect_caller_information";

  if (input.nodeId === "lookup_customer" || input.nodeId === "detect_intent") {
    return "detect_intent";
  }

  if (input.nodeId === "collect_fields") return "classify";

  if (input.nodeId === "classify") {
    if (input.hasHeldSlot) return "confirm_booking";
    if (input.hasSlots) return "select_slot";
    return "check_availability";
  }

  if (input.nodeId === "validate_eligibility") return "validate_eligibility";

  if (!input.hasSlots && !input.hasHeldSlot) return "check_availability";
  return "converse";
}

/**
 * Build the authoritative workflow view from session + graph.
 * Does not mutate session.
 */
export function buildCanonicalWorkflowState(input: {
  session: AmyRealtimeSession;
  workflow: WorkflowDefinition;
}): CanonicalWorkflowState {
  const storedNodeId =
    input.session.currentNodeId ||
    input.session.runtime.current_node_id ||
    input.workflow.entryNodeId;

  const currentNodeId = deriveAuthoritativeNodeId({
    session: input.session,
    workflow: input.workflow,
    storedNodeId,
  });

  const missingFieldIds = missingFieldIdsFromSession(input.session);
  const missingCount = missingFieldIds.length;
  const legacyState = legacyStateForNode(currentNodeId, input.workflow.id);
  const slots = hasAvailableSlots(input.session);
  const held = hasHeldSlot(input.session);
  const bookingReceiptPresent = hasBookingReceipt(input.session);
  const callerIntent = callerIntentFromSession(input.session);
  const modifyFlow =
    callerIntent === "reschedule" ||
    callerIntent === "cancel" ||
    Boolean(input.session.runtime?.session_runtime?.foundAppointmentId?.trim());
  const readyForAvailability = modifyFlow
    ? [
        "reschedule_lookup",
        "cancel_lookup",
        "check_availability",
        "select_slot",
        "confirm_booking",
        "cancel_confirm",
      ].includes(currentNodeId) || fieldsComplete(input.session)
    : fieldsComplete(input.session);

  return {
    currentNodeId,
    legacyState,
    missingFieldIds,
    readyForAvailability,
    bookingReceiptPresent,
    bookingInProgress: !bookingReceiptPresent && (held || slots),
    expectedNextAction: deriveExpectedNextAction({
      nodeId: currentNodeId,
      missingCount,
      hasSlots: slots,
      hasHeldSlot: held,
      bookingReceiptPresent,
      callerIntent: callerIntentFromSession(input.session),
    }),
  };
}

/**
 * Write canonical node position back to session. legacyState is always derived.
 */
export function syncSessionFromCanonical(input: {
  session: AmyRealtimeSession;
  workflow: WorkflowDefinition;
  canonical: CanonicalWorkflowState;
}): AmyRealtimeSession {
  const { canonical } = input;
  input.session.currentNodeId = canonical.currentNodeId;
  input.session.currentState = canonical.legacyState;
  input.session.voiceWorkflowId = input.workflow.id;
  input.session.voiceWorkflowVersion = input.workflow.version;
  input.session.runtime = {
    ...input.session.runtime,
    state: canonical.legacyState,
    current_node_id: canonical.currentNodeId,
    voice_workflow_id: input.workflow.id,
    voice_workflow_version: input.workflow.version,
  };
  return input.session;
}

/**
 * Reconcile session position after a mutation (field save, tool result, etc.).
 * Advances the graph deterministically and syncs derived legacy state.
 */
export function reconcileCanonicalWorkflowState(input: {
  session: AmyRealtimeSession;
  workflow: WorkflowDefinition;
  toolName?: string;
  toolResult?: { ok: boolean; data?: Record<string, unknown> };
}): CanonicalWorkflowState {
  if (input.toolName && input.toolResult) {
    const previousNodeId =
      input.session.currentNodeId ||
      input.session.runtime.current_node_id ||
      input.workflow.entryNodeId;

    const transitioned = resolveNextNodeId({
      workflow: input.workflow,
      currentNodeId: previousNodeId,
      toolName: input.toolName,
      result: input.toolResult,
      session: input.session,
    });
    input.session.currentNodeId = transitioned;
  }

  const canonical = buildCanonicalWorkflowState({
    session: input.session,
    workflow: input.workflow,
  });
  syncSessionFromCanonical({
    session: input.session,
    workflow: input.workflow,
    canonical,
  });
  return canonical;
}

/** Map canonical next action to tool name the runtime expects to be exposed. */
export function expectedToolForNextAction(action: CanonicalNextAction): string | null {
  switch (action) {
    case "check_availability":
      return "check_availability";
    case "select_slot":
      return "select_slot";
    case "confirm_booking":
      return "confirm_booking";
    case "detect_intent":
      return "detect_caller_intent";
    case "classify":
      return "classify_intent";
    case "validate_eligibility":
      return "validate_eligibility";
    case "find_appointments":
      return "find_appointments";
    case "reschedule_appointment":
      return "reschedule_appointment";
    case "cancel_appointment":
      return "cancel_appointment";
    case "collect_caller_information":
      return "submit_caller_information";
    case "complete":
      return "end_call";
    default:
      return null;
  }
}
