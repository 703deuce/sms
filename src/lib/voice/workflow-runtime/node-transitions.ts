import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import { saveAgentRuntime, loadAgentRuntime } from "@/lib/voice/workflow-engine/runtime-state";
import { hasHeldSlot, missingRequiredFieldCount } from "./completion-guards";
import type { WorkflowDefinition, WorkflowNode } from "./schema";

export type WorkflowToolResult = {
  ok: boolean;
  error_code?: string;
  data?: Record<string, unknown>;
};

function getNode(def: WorkflowDefinition, nodeId: string): WorkflowNode | undefined {
  return def.nodes.find((n) => n.id === nodeId);
}

export function legacyStateForNode(nodeId: string, workflowId: string): WorkflowState {
  const map: Record<string, WorkflowState> = {
    lookup_customer: "INTENT_DISCOVERY",
    detect_intent: "INTENT_DISCOVERY",
    collect_fields: "COLLECTING_FIELDS",
    classify: "COLLECTING_FIELDS",
    validate_eligibility: "COLLECTING_FIELDS",
    check_availability: "CHECKING_AVAILABILITY",
    select_slot: "SELECTING_SLOT",
    confirm_booking: "READY_TO_BOOK",
    reschedule_lookup: "GENERAL",
    cancel_lookup: "GENERAL",
    cancel_confirm: "READY_TO_BOOK",
    emergency_handoff: "GENERAL",
    transfer_fallback: "GENERAL",
    save_message: "GENERAL",
    complete: "COMPLETE",
  };
  if (workflowId === "message_taking" && nodeId === "collect_fields") {
    return "COLLECTING_FIELDS";
  }
  return map[nodeId] || "COLLECTING_FIELDS";
}

export function resolveNextNodeId(input: {
  workflow: WorkflowDefinition;
  currentNodeId: string;
  toolName: string;
  result: WorkflowToolResult;
  session: AmyRealtimeSession;
}): string {
  const node = getNode(input.workflow, input.currentNodeId);
  if (!node) return input.workflow.entryNodeId;

  const missing = missingRequiredFieldCount(input.session);

  if (
    (input.toolName === "submit_caller_information" ||
      input.toolName === "record_current_field" ||
      input.toolName === "record_fields") &&
    input.result.ok
  ) {
    if (hasHeldSlot(input.session) && getNode(input.workflow, "confirm_booking")) {
      return "confirm_booking";
    }
    if (missing === 0) {
      const collectNode = getNode(input.workflow, "collect_fields");
      const edge = collectNode?.transitions.find((t) => t.when === "fields_complete");
      return edge?.to || "classify";
    }
    if (node.id !== "collect_fields" && getNode(input.workflow, "collect_fields")) {
      return "collect_fields";
    }
    return input.currentNodeId;
  }

  if (input.toolName === "check_availability" && input.result.ok) {
    const checkNode = getNode(input.workflow, "check_availability");
    if (checkNode) return checkNode.transitions[0]?.to || "select_slot";
    if (getNode(input.workflow, "select_slot")) return "select_slot";
  }

  if (input.toolName === "select_slot" && input.result.ok) {
    if (getNode(input.workflow, "confirm_booking")) return "confirm_booking";
  }

  if (
    input.toolName === "confirm_booking" &&
    input.result.ok &&
    (input.result.data?.booking != null || input.session.bookingId)
  ) {
    return getNode(input.workflow, "complete") ? "complete" : input.currentNodeId;
  }

  if (input.toolName === "get_booking_requirements" && input.result.ok && missing === 0) {
    const collectNode = getNode(input.workflow, "collect_fields");
    const edge = collectNode?.transitions.find((t) => t.when === "fields_complete");
    return edge?.to || "check_availability";
  }

  if (input.toolName === "detect_caller_intent" && input.result.ok) {
    const intent = String(input.result.data?.intent || "");
    if (intent === "emergency") {
      return getNode(input.workflow, "detect_intent")?.transitions.find((t) => t.when === "emergency")
        ?.to || "emergency_handoff";
    }
    if (intent === "reschedule") {
      return getNode(input.workflow, "detect_intent")?.transitions.find(
        (t) => t.when === "reschedule_intent",
      )?.to || "reschedule_lookup";
    }
    if (intent === "cancel") {
      return getNode(input.workflow, "detect_intent")?.transitions.find((t) => t.when === "cancel_intent")
        ?.to || "cancel_lookup";
    }

    const detectNode = getNode(input.workflow, "detect_intent");
    if (detectNode && (node.id === "lookup_customer" || node.id === "detect_intent")) {
      const edge =
        detectNode.transitions.find((t) => t.when === "book_intent") ||
        detectNode.transitions.find((t) => t.when === "default");
      return edge?.to || "collect_fields";
    }
  }

  if (node.type === "collect_fields") {
    const missingCount = missingRequiredFieldCount(input.session);
    if (missingCount === 0) {
      if (hasHeldSlot(input.session) && getNode(input.workflow, "confirm_booking")) {
        return "confirm_booking";
      }
      const edge = node.transitions.find((t) => t.when === "fields_complete");
      return edge?.to || node.transitions[0]?.to || input.currentNodeId;
    }
    return input.currentNodeId;
  }

  if (node.type === "action") {
    if (
      node.capability === "customer.lookup" &&
      input.toolName === "lookup_customer" &&
      input.result.ok
    ) {
      return node.transitions[0]?.to || "detect_intent";
    }
    if (
      node.capability === "intent.detect" &&
      input.toolName === "detect_caller_intent" &&
      input.result.ok
    ) {
      const intent = String(input.result.data?.intent || "");
      if (intent === "emergency") {
        const edge = node.transitions.find((t) => t.when === "emergency");
        return edge?.to || "emergency_handoff";
      }
      if (intent === "reschedule") {
        const edge = node.transitions.find((t) => t.when === "reschedule_intent");
        return edge?.to || "reschedule_lookup";
      }
      if (intent === "cancel") {
        const edge = node.transitions.find((t) => t.when === "cancel_intent");
        return edge?.to || "cancel_lookup";
      }
      const edge =
        node.transitions.find((t) => t.when === "book_intent") ||
        node.transitions.find((t) => t.when === "default");
      return edge?.to || "collect_fields";
    }
    if (
      node.capability === "rules.classify" &&
      input.toolName === "classify_intent" &&
      input.result.ok
    ) {
      const emergency = Boolean(
        input.result.data?.classifications &&
          ((input.result.data.classifications as Record<string, string>).urgency === "emergency" ||
            (input.result.data.classifications as Record<string, string>).safety === "gas_smell"),
      );
      if (emergency) {
        const edge = node.transitions.find((t) => t.when === "emergency");
        return edge?.to || "emergency_handoff";
      }
      const edge = node.transitions.find((t) => t.when === "normal");
      return edge?.to || node.transitions[0]?.to || input.currentNodeId;
    }
    if (
      node.capability === "eligibility.validate" &&
      input.toolName === "validate_eligibility" &&
      input.result.ok
    ) {
      return node.transitions[0]?.to || "check_availability";
    }
    if (
      node.capability === "calendar.find_appointments" &&
      input.toolName === "find_appointments" &&
      input.result.ok
    ) {
      const appointments = input.result.data?.appointments;
      const found = Array.isArray(appointments) && appointments.length > 0;
      if (found) {
        return node.transitions[0]?.to || input.currentNodeId;
      }
      return input.currentNodeId;
    }
    if (
      node.capability === "calendar.check_availability" &&
      input.toolName === "check_availability" &&
      input.result.ok
    ) {
      return node.transitions[0]?.to || "select_slot";
    }
    if (
      node.capability === "message.save" &&
      (input.toolName === "take_message" || input.toolName === "save_message") &&
      input.result.ok
    ) {
      return node.transitions[0]?.to || "complete";
    }
    return input.currentNodeId;
  }

  if (node.type === "condition") {
    if (input.toolName === "classify_intent" && input.result.ok) {
      const classifications = (input.result.data?.classifications || {}) as Record<string, string>;
      const emergency =
        classifications.urgency === "emergency" || classifications.safety === "gas_smell";
      if (emergency) {
        const edge = node.transitions.find((t) => t.when === "emergency");
        return edge?.to || "emergency_handoff";
      }
      const edge = node.transitions.find((t) => t.when === "normal");
      return edge?.to || node.transitions[0]?.to || input.currentNodeId;
    }
    return input.currentNodeId;
  }

  if (node.type === "choice" && input.toolName === "select_slot" && input.result.ok) {
    return node.transitions[0]?.to || "confirm_booking";
  }

  if (
    node.type === "choice" &&
    input.toolName === "record_current_field" &&
    input.session.missingFieldIds.length === 0
  ) {
    return node.transitions[0]?.to || input.currentNodeId;
  }

  if (node.type === "handoff" && input.toolName === "request_human") {
    if (input.result.ok) {
      return "complete";
    }
    const edge = node.transitions.find((t) => t.when === "default");
    return edge?.to || "transfer_fallback";
  }

  if (node.type === "confirmation" && input.toolName === "confirm_booking") {
    if (input.result.ok) {
      const edge = node.transitions.find((t) => t.when === "confirmation_received");
      return edge?.to || "complete";
    }
    const needsMoreFields =
      input.session.missingFieldIds.length > 0 ||
      input.result.error_code === "MISSING_REQUIRED_FIELD" ||
      input.result.data?.needsFieldCollection === true;
    if (needsMoreFields) {
      return "collect_fields";
    }
  }

  if (node.type === "confirmation" && input.toolName === "cancel_appointment" && input.result.ok) {
    const edge = node.transitions.find((t) => t.when === "confirmation_received");
    return edge?.to || "complete";
  }

  if (node.type === "confirmation" && input.toolName === "reschedule_appointment" && input.result.ok) {
    const edge = node.transitions.find((t) => t.when === "confirmation_received");
    return edge?.to || "complete";
  }

  return input.currentNodeId;
}

export async function applyWorkflowNodeTransition(input: {
  workflow: WorkflowDefinition;
  callId: string;
  session: AmyRealtimeSession;
  toolName: string;
  result: WorkflowToolResult;
}): Promise<{ currentNodeId: string; legacyState: WorkflowState }> {
  const previousNodeId =
    input.session.currentNodeId ||
    input.session.runtime.current_node_id ||
    input.workflow.entryNodeId;

  const nextNodeId = resolveNextNodeId({
    workflow: input.workflow,
    currentNodeId: previousNodeId,
    toolName: input.toolName,
    result: input.result,
    session: input.session,
  });

  const legacyState = legacyStateForNode(nextNodeId, input.workflow.id);
  const confirmationReceived =
    input.toolName === "confirm_booking" && input.result.ok && input.result.data?.booking != null;

  input.session.currentNodeId = nextNodeId;
  input.session.voiceWorkflowId = input.workflow.id;
  input.session.voiceWorkflowVersion = input.workflow.version;
  input.session.currentState = legacyState;
  if (confirmationReceived) {
    input.session.confirmationState = "confirmed";
  }

  input.session.runtime = {
    ...input.session.runtime,
    state: legacyState,
    voice_workflow_id: input.workflow.id,
    voice_workflow_version: input.workflow.version,
    current_node_id: nextNodeId,
    confirmation_received: confirmationReceived || input.session.runtime.confirmation_received,
  };

  const runtime = await loadAgentRuntime(input.callId);
  if (runtime) {
    await saveAgentRuntime(input.callId, {
      ...runtime,
      state: legacyState,
      voice_workflow_id: input.workflow.id,
      voice_workflow_version: input.workflow.version,
      current_node_id: nextNodeId,
      confirmation_received: confirmationReceived || runtime.confirmation_received,
    });
  }

  console.log(
    JSON.stringify({
      source: "transovo-voice-runtime",
      event: "node_transition",
      callId: input.callId,
      workflowId: input.workflow.id,
      workflowVersion: input.workflow.version,
      toolName: input.toolName,
      previousNodeId,
      nextNodeId,
      legacyState,
      success: input.result.ok,
    }),
  );

  return { currentNodeId: nextNodeId, legacyState };
}
