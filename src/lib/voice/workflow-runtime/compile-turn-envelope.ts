import { toolNamesForCapabilities } from "@/lib/voice/capability-registry";
import type {
  TurnToolEnvelope,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowRuntimeSnapshot,
  WorkflowTransition,
} from "./schema";

function getNode(def: WorkflowDefinition, nodeId: string): WorkflowNode {
  const node = def.nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Workflow node not found: ${nodeId}`);
  return node;
}

function missingRequiredFields(
  node: WorkflowNode,
  state: WorkflowRuntimeSnapshot,
): string[] {
  if (!node.fields?.length) {
    const count = Number(state.flags.missingFieldCount ?? 0);
    if (count > 0) {
      return Array.from({ length: count }, (_, i) => `_missing_${i}`);
    }
    return [];
  }
  return node.fields
    .filter((f) => f.required && !state.collectedFields[f.id]?.trim())
    .map((f) => f.id);
}

function pickTransition(
  node: WorkflowNode,
  state: WorkflowRuntimeSnapshot,
  context: { fieldsComplete?: boolean },
): WorkflowTransition | null {
  if (!node.transitions.length) return null;

  const fieldsComplete = context.fieldsComplete === true;

  for (const edge of node.transitions) {
    if (edge.when === "fields_complete" && fieldsComplete) return edge;
    if (edge.when === "confirmation_received" && state.confirmationReceived) return edge;
    if (edge.when === "emergency" && state.flags.emergency) return edge;
    if (edge.when === "normal" && !state.flags.emergency) return edge;
    if (edge.when === "book_intent" && state.flags.bookIntent) return edge;
    if (edge.when === "reschedule_intent" && state.flags.rescheduleIntent) return edge;
    if (edge.when === "cancel_intent" && state.flags.cancelIntent) return edge;
  }

  return (
    node.transitions.find((e) => e.when === "default" || !e.when) || node.transitions[0]
  );
}

function nodeCapabilities(node: WorkflowNode): string[] {
  const caps: string[] = [];
  if (node.type === "collect_fields") {
    caps.push("data.capture", "data.lookup");
  }
  // Booking confirmation may still need late identity fields (e.g. Calendly email).
  if (node.type === "confirmation") {
    caps.push("data.capture", "data.lookup");
  }
  if (node.capability) caps.push(node.capability);
  if (node.type === "handoff") caps.push("call.transfer");
  if (node.type === "completion") caps.push("call.end");
  return caps;
}

function isHardUserBoundary(
  node: WorkflowNode,
  state: WorkflowRuntimeSnapshot,
): boolean {
  if (node.type === "choice") return true;
  if (node.type === "confirmation" && !state.confirmationReceived) return true;
  if (node.type === "collect_fields") {
    const missing = missingRequiredFields(node, state);
    return missing.length > 1;
  }
  return node.requiresUserInput === true;
}

function buildTaskInstructions(
  def: WorkflowDefinition,
  visited: string[],
): string {
  return visited
    .map((id) => getNode(def, id).instructions)
    .filter(Boolean)
    .join("\n");
}

/**
 * Compile the tool envelope for the current LiveKit model turn.
 *
 * Traverses the workflow graph from the current node, collecting capabilities
 * reachable before the next caller-interaction boundary.
 */
export function compileTurnCapabilityEnvelope(input: {
  workflow: WorkflowDefinition;
  state: WorkflowRuntimeSnapshot;
}): TurnToolEnvelope {
  const { workflow, state } = input;
  const capabilityIds = new Set<string>();
  const visitedNodeIds: string[] = [];
  let nodeId: string | null = state.currentNodeId;
  let stoppedAtUserBoundary = false;
  let stoppedAtNodeId: string | null = null;

  for (const cap of workflow.globalPolicies?.alwaysAllow || ["call.transfer", "call.end"]) {
    capabilityIds.add(cap);
  }

  const globalMissingCount = Number(state.flags.missingFieldCount ?? 0);
  if (globalMissingCount > 0) {
    capabilityIds.add("data.capture");
    capabilityIds.add("data.lookup");
  }

  while (nodeId) {
    const node = getNode(workflow, nodeId);
    if (visitedNodeIds.includes(node.id)) break;
    visitedNodeIds.push(node.id);

    const missing =
      node.type === "collect_fields" ? missingRequiredFields(node, state) : [];
    const fieldsComplete =
      node.type === "collect_fields"
        ? Number(state.flags.missingFieldCount ?? 0) === 0 && missing.length === 0
        : missing.length === 0;

    if (!(node.type === "collect_fields" && fieldsComplete)) {
      for (const cap of nodeCapabilities(node)) {
        capabilityIds.add(cap);
      }
    }

    if (isHardUserBoundary(node, state)) {
      stoppedAtUserBoundary = true;
      stoppedAtNodeId = node.id;
      break;
    }

    const edge = pickTransition(node, state, {
      fieldsComplete,
    });
    if (!edge) break;

    const next = getNode(workflow, edge.to);

    // Pre-register next-node capabilities only after all required fields are collected.
    if (fieldsComplete || !isHardUserBoundary(next, state)) {
      for (const cap of nodeCapabilities(next)) {
        capabilityIds.add(cap);
      }
    }

    if (isHardUserBoundary(next, state)) {
      stoppedAtUserBoundary = true;
      stoppedAtNodeId = next.id;
      break;
    }

    // Automatic nodes (actions) run in same turn — keep walking
    if (next.type === "action" || next.type === "handoff") {
      nodeId = next.id;
      continue;
    }

    if (next.type === "collect_fields" || next.type === "choice" || next.type === "confirmation") {
      nodeId = next.id;
      if (isHardUserBoundary(next, state)) {
        stoppedAtUserBoundary = true;
        stoppedAtNodeId = next.id;
      }
      break;
    }

    nodeId = next.id;
  }

  const toolNames = toolNamesForCapabilities(capabilityIds);
  return {
    currentNodeId: state.currentNodeId,
    capabilityIds: [...capabilityIds],
    toolNames,
    taskInstructions: buildTaskInstructions(workflow, visitedNodeIds),
    visitedNodeIds,
    stoppedAtUserBoundary,
    stoppedAtNodeId,
  };
}

function resolveSnapshotNodeId(input: {
  workflow: WorkflowDefinition;
  legacyState: string;
  currentNodeId?: string | null;
  flags?: Record<string, unknown>;
}): string {
  const nodeIds = new Set(input.workflow.nodes.map((n) => n.id));
  let nodeId =
    input.currentNodeId && nodeIds.has(input.currentNodeId)
      ? input.currentNodeId
      : legacyStateToNodeId(input.workflow, input.legacyState);

  const missingCount = Number(input.flags?.missingFieldCount ?? 0);
  if (
    nodeId === "collect_fields" &&
    !["INTENT_DISCOVERY", "COLLECTING_FIELDS"].includes(input.legacyState)
  ) {
    const collectNode = input.workflow.nodes.find((n) => n.id === "collect_fields");
    const edge = collectNode?.transitions.find((t) => t.when === "fields_complete");
    if (edge?.to) nodeId = edge.to;
  } else if (
    nodeId === "collect_fields" &&
    input.legacyState === "COLLECTING_FIELDS" &&
    missingCount === 0
  ) {
    const collectNode = input.workflow.nodes.find((n) => n.id === "collect_fields");
    const edge = collectNode?.transitions.find((t) => t.when === "fields_complete");
    if (edge?.to) nodeId = edge.to;
  }

  if (input.legacyState === "SELECTING_SLOT" && nodeIds.has("select_slot")) {
    nodeId = "select_slot";
  }
  if (
    (input.legacyState === "READY_TO_BOOK" || input.legacyState === "BOOKING_IN_PROGRESS") &&
    nodeIds.has("confirm_booking")
  ) {
    nodeId = "confirm_booking";
  }

  return nodeId;
}

export function legacyStateToNodeId(
  workflow: WorkflowDefinition,
  legacyState: string,
): string {
  const map: Record<string, string> = {
    INTENT_DISCOVERY: "lookup_customer",
    COLLECTING_FIELDS: "collect_fields",
    CHECKING_AVAILABILITY: "check_availability",
    SELECTING_SLOT: "select_slot",
    READY_TO_BOOK: "confirm_booking",
    BOOKING_IN_PROGRESS: "confirm_booking",
    COMPLETE: "complete",
    GENERAL: "complete",
  };
  const candidate = map[legacyState];
  if (candidate && workflow.nodes.some((n) => n.id === candidate)) {
    return candidate;
  }
  return workflow.entryNodeId;
}

export function buildRuntimeSnapshotFromSession(input: {
  workflow: WorkflowDefinition;
  workflowVersion: number;
  legacyState: string;
  currentNodeId?: string | null;
  collectedFields: Record<string, string>;
  confirmationReceived?: boolean;
  flags?: Record<string, unknown>;
}): WorkflowRuntimeSnapshot {
  const authoritative = resolveSnapshotNodeId({
    workflow: input.workflow,
    legacyState: input.legacyState,
    currentNodeId: input.currentNodeId,
    flags: input.flags,
  });

  return {
    workflowId: input.workflow.id,
    workflowVersion: input.workflowVersion,
    currentNodeId: authoritative,
    collectedFields: input.collectedFields,
    confirmationReceived: input.confirmationReceived ?? false,
    flags: input.flags ?? {},
  };
}
