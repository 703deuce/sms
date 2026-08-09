import type { WorkflowDraft, WorkflowDraftNode } from "@/lib/agents/appointment-booking/workflow-validator";
import type { WorkflowDefinition, WorkflowFieldSpec, WorkflowNode } from "./schema";
import {
  APPOINTMENT_BOOKING_WORKFLOW_V1,
  MESSAGE_TAKING_WORKFLOW_V1,
} from "./definitions";

function blockTypes(draft: WorkflowDraft): Set<string> {
  return new Set(draft.nodes.map((n) => n.type));
}

function collectFieldKeys(nodes: WorkflowDraftNode[]): string[] {
  const keys: string[] = [];
  for (const node of nodes) {
    if (node.type !== "collect_field") continue;
    const fields = node.config.fields;
    if (Array.isArray(fields)) {
      for (const f of fields) keys.push(String(f));
    } else if (node.config.fieldKey) {
      keys.push(String(node.config.fieldKey));
    }
  }
  return [...new Set(keys)];
}

function fieldSpecsFromKeys(keys: string[]): WorkflowFieldSpec[] {
  const labelFor: Record<string, string> = {
    name: "Name",
    full_name: "Name",
    phone: "Phone number",
    message: "Message",
    service: "Service",
    service_needed: "Service needed",
    service_address: "Service address",
    problem_description: "Problem description",
    preferred_time_of_day: "Preferred callback time",
    callback_number: "Callback number",
    caller_name: "Name",
  };
  return keys.map((id) => ({
    id,
    type: id.includes("message") || id.includes("description") ? "long_text" : "text",
    required: true,
    label: labelFor[id] || id.replaceAll("_", " "),
    instruction: `May I have your ${(labelFor[id] || id).toLowerCase()}?`,
  }));
}

function hasEmergencyBranch(draft: WorkflowDraft): boolean {
  return draft.nodes.some(
    (n) =>
      n.type === "branch" &&
      JSON.stringify(n.config).toLowerCase().includes("emergency"),
  );
}

function compileBookingWorkflow(draft: WorkflowDraft): WorkflowDefinition {
  const base = structuredClone(APPOINTMENT_BOOKING_WORKFLOW_V1);
  const fieldKeys = collectFieldKeys(draft.nodes);
  const nodes: WorkflowNode[] = base.nodes.map((node) => {
    if (node.id !== "collect_fields" || !fieldKeys.length) return node;
    return {
      ...node,
      fields: fieldSpecsFromKeys(fieldKeys),
      metadata: { ...node.metadata, manifestDriven: false, architectFields: fieldKeys },
    };
  });

  if (hasEmergencyBranch(draft)) {
    const emergencyNode: WorkflowNode = {
      id: "route_intent",
      type: "condition",
      instructions:
        "If the caller describes an emergency, call request_human immediately. Otherwise continue collecting booking information.",
      requiresUserInput: true,
      transitions: [
        { to: "collect_fields", when: "normal" },
        { to: "emergency_handoff", when: "emergency" },
      ],
    };
    const handoffNode: WorkflowNode = {
      id: "emergency_handoff",
      type: "handoff",
      capability: "call.transfer",
      instructions: "Transfer the caller to on-call staff for emergencies.",
      requiresUserInput: false,
      transitions: [{ to: "complete", when: "default" }],
    };
    return {
      ...base,
      id: draft.id,
      version: draft.version || 1,
      name: draft.name,
      entryNodeId: "route_intent",
      nodes: [emergencyNode, handoffNode, ...nodes],
      metadata: { source: "architect", draftId: draft.id },
    };
  }

  return {
    ...base,
    id: draft.id,
    version: draft.version || 1,
    name: draft.name,
    nodes,
    metadata: { source: "architect", draftId: draft.id },
  };
}

function compileMessageWorkflow(draft: WorkflowDraft): WorkflowDefinition {
  const base = structuredClone(MESSAGE_TAKING_WORKFLOW_V1);
  const fieldKeys = collectFieldKeys(draft.nodes);
  const nodes: WorkflowNode[] = base.nodes.map((node) => {
    if (node.id !== "collect_fields" || !fieldKeys.length) return node;
    return {
      ...node,
      fields: fieldSpecsFromKeys(fieldKeys),
      metadata: { ...node.metadata, manifestDriven: false, architectFields: fieldKeys },
    };
  });
  return {
    ...base,
    id: draft.id,
    version: draft.version || 1,
    name: draft.name,
    nodes,
    metadata: { source: "architect", draftId: draft.id },
  };
}

/**
 * Compile a validated Workflow Architect draft into a voice WorkflowDefinition.
 * Maps approved architect blocks to generic runtime node types + capabilities.
 */
export function compileArchitectDraftToWorkflowDefinition(
  draft: WorkflowDraft,
): WorkflowDefinition {
  const types = blockTypes(draft);
  const hasBooking =
    types.has("check_availability") ||
    types.has("create_appointment") ||
    types.has("hold_appointment_slot") ||
    types.has("offer_slots");
  const hasMessage = types.has("take_message");
  const hasTransferOnly =
    (types.has("transfer_call") || types.has("use_fallback_transfer")) && !hasBooking;

  if (hasBooking) return compileBookingWorkflow(draft);
  if (hasMessage && !hasBooking) return compileMessageWorkflow(draft);
  if (hasTransferOnly) {
    return {
      schemaVersion: 1,
      id: draft.id,
      version: draft.version || 1,
      name: draft.name,
      description: "Transfer-first workflow compiled from architect draft.",
      entryNodeId: "handoff",
      globalPolicies: { alwaysAllow: ["call.end"] },
      nodes: [
        {
          id: "handoff",
          type: "handoff",
          capability: "call.transfer",
          instructions: "Connect the caller with a human using request_human.",
          requiresUserInput: false,
          transitions: [{ to: "complete", when: "default" }],
        },
        {
          id: "complete",
          type: "completion",
          instructions: "Wrap up politely.",
          transitions: [],
        },
      ],
      metadata: { source: "architect", draftId: draft.id },
    };
  }

  return compileBookingWorkflow(draft);
}
