import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import { legacyStateForNode } from "./node-transitions";
import { resolveNextNodeId } from "./node-transitions";
import type { WorkflowDefinition } from "./schema";

/** Canonical progression view — currentNodeId is the single source of truth. */
export type CanonicalWorkflowState = {
  currentNodeId: string;
  /** Derived from currentNodeId — never written independently. */
  legacyState: WorkflowState;
  missingFieldIds: string[];
  readyForAvailability: boolean;
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
  | "complete"
  | "converse";

function missingFieldIdsFromSession(session: AmyRealtimeSession): string[] {
  return session.fieldManifest
    .filter((field) => field.required && !session.collectedFields[field.field_id]?.trim())
    .map((field) => field.field_id);
}

function deriveExpectedNextAction(input: {
  nodeId: string;
  missingCount: number;
  hasSlots: boolean;
  hasHeldSlot: boolean;
  confirmationReceived: boolean;
}): CanonicalNextAction {
  if (input.confirmationReceived || input.nodeId === "complete") return "complete";

  if (input.nodeId === "lookup_customer" || input.nodeId === "detect_intent") {
    return input.missingCount > 0 ? "collect_caller_information" : "detect_intent";
  }

  if (input.nodeId === "collect_fields") {
    return input.missingCount > 0 ? "collect_caller_information" : "classify";
  }

  if (input.nodeId === "classify") return "classify";
  if (input.nodeId === "validate_eligibility") return "validate_eligibility";

  if (input.nodeId === "check_availability") return "check_availability";

  if (input.nodeId === "select_slot") {
    return input.hasHeldSlot ? "confirm_booking" : "select_slot";
  }

  if (input.nodeId === "confirm_booking") {
    return input.hasHeldSlot || input.hasSlots ? "confirm_booking" : "check_availability";
  }

  if (input.missingCount > 0) return "collect_caller_information";
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
  const nodeIds = new Set(input.workflow.nodes.map((n) => n.id));
  const missingFieldIds = missingFieldIdsFromSession(input.session);
  const missingCount = missingFieldIds.length;

  let currentNodeId =
    input.session.currentNodeId ||
    input.session.runtime.current_node_id ||
    input.workflow.entryNodeId;

  if (!nodeIds.has(currentNodeId)) {
    currentNodeId = input.workflow.entryNodeId;
  }

  // Deterministic advance when required fields are complete but cursor is still on early nodes.
  if (
    missingCount === 0 &&
    (currentNodeId === "lookup_customer" ||
      currentNodeId === "detect_intent" ||
      currentNodeId === "collect_fields")
  ) {
    const collectNode = input.workflow.nodes.find((n) => n.id === "collect_fields");
    const edge = collectNode?.transitions.find((t) => t.when === "fields_complete");
    if (edge?.to && nodeIds.has(edge.to)) {
      currentNodeId = edge.to;
    }
  }

  const legacyState = legacyStateForNode(currentNodeId, input.workflow.id);
  const hasSlots = (input.session.availableSlots || []).length > 0;
  const hasHeldSlot = Boolean(input.session.heldSlot || input.session.selectedSlot);
  const confirmationReceived =
    input.session.confirmationState === "confirmed" ||
    Boolean(input.session.runtime.confirmation_received);

  return {
    currentNodeId,
    legacyState,
    missingFieldIds,
    readyForAvailability: missingCount === 0,
    expectedNextAction: deriveExpectedNextAction({
      nodeId: currentNodeId,
      missingCount,
      hasSlots,
      hasHeldSlot,
      confirmationReceived,
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
  const previousNodeId =
    input.session.currentNodeId ||
    input.session.runtime.current_node_id ||
    input.workflow.entryNodeId;

  let nextNodeId = previousNodeId;

  if (input.toolName && input.toolResult) {
    nextNodeId = resolveNextNodeId({
      workflow: input.workflow,
      currentNodeId: previousNodeId,
      toolName: input.toolName,
      result: input.toolResult,
      session: input.session,
    });
  } else if (input.session.missingFieldIds.length === 0) {
    nextNodeId = resolveNextNodeId({
      workflow: input.workflow,
      currentNodeId: previousNodeId,
      toolName: "record_current_field",
      result: { ok: true },
      session: input.session,
    });
  }

  input.session.currentNodeId = nextNodeId;
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
    case "collect_caller_information":
      return "submit_caller_information";
    case "complete":
      return "end_call";
    default:
      return null;
  }
}
