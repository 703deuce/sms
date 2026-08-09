import type { DomainActionResult } from "@/lib/voice/domain-actions/booking-actions";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import { saveAgentRuntime, loadAgentRuntime } from "@/lib/voice/workflow-engine/runtime-state";
import type { WorkflowDefinition, WorkflowNode } from "./schema";

function getNode(def: WorkflowDefinition, nodeId: string): WorkflowNode | undefined {
  return def.nodes.find((n) => n.id === nodeId);
}

function legacyStateForNode(nodeId: string, workflowId: string): WorkflowState {
  const map: Record<string, WorkflowState> = {
    collect_fields: "COLLECTING_FIELDS",
    check_availability: "CHECKING_AVAILABILITY",
    select_slot: "SELECTING_SLOT",
    confirm_booking: "READY_TO_BOOK",
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
  result: DomainActionResult;
  session: AmyRealtimeSession;
}): string {
  const node = getNode(input.workflow, input.currentNodeId);
  if (!node) return input.workflow.entryNodeId;

  const missing = input.session.missingFieldIds.length;

  if (node.type === "collect_fields") {
    if (missing === 0 || input.result.data?.readyForAvailability) {
      const edge = node.transitions.find((t) => t.when === "fields_complete");
      return edge?.to || node.transitions[0]?.to || input.currentNodeId;
    }
    return input.currentNodeId;
  }

  if (node.type === "action") {
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

  if (node.type === "handoff" && input.toolName === "request_human" && input.result.ok) {
    return node.transitions[0]?.to || "complete";
  }

  if (node.type === "confirmation" && input.toolName === "confirm_booking" && input.result.ok) {
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
  result: DomainActionResult;
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
  input.session.workflowState = legacyState;
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
