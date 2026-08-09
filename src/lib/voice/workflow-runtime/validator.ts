import { getCapability, listCapabilityIds } from "@/lib/voice/capability-registry";
import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowValidationError,
} from "./schema";

function nodeMap(def: WorkflowDefinition): Map<string, WorkflowNode> {
  return new Map(def.nodes.map((n) => [n.id, n]));
}

export function validateWorkflowDefinition(
  def: WorkflowDefinition,
): WorkflowValidationError[] {
  const errors: WorkflowValidationError[] = [];
  const byId = nodeMap(def);
  const capabilityIds = new Set(listCapabilityIds());

  if (!def.nodes.length) {
    errors.push({ code: "empty_graph", message: "Workflow has no nodes" });
    return errors;
  }

  if (!def.entryNodeId || !byId.has(def.entryNodeId)) {
    errors.push({
      code: "missing_entry",
      message: "entryNodeId must reference an existing node",
    });
  }

  for (const node of def.nodes) {
    if (node.capability && !capabilityIds.has(node.capability)) {
      errors.push({
        nodeId: node.id,
        code: "unknown_capability",
        message: `Unknown capability: ${node.capability}`,
      });
    }

    if (
      node.type === "collect_fields" &&
      (!node.fields || node.fields.length === 0) &&
      node.metadata?.manifestDriven !== true
    ) {
      errors.push({
        nodeId: node.id,
        code: "missing_fields",
        message: "collect_fields node requires fields[]",
      });
    }

    if (node.type === "action" && !node.capability) {
      errors.push({
        nodeId: node.id,
        code: "missing_capability",
        message: "action node requires capability",
      });
    }

    for (const edge of node.transitions) {
      if (!byId.has(edge.to)) {
        errors.push({
          nodeId: node.id,
          code: "invalid_transition",
          message: `Transition to unknown node: ${edge.to}`,
        });
      }
    }

    if (node.type === "confirmation" && node.requiresExplicitConfirmation !== true) {
      errors.push({
        nodeId: node.id,
        code: "confirmation_flag",
        message: "confirmation nodes must set requiresExplicitConfirmation=true",
      });
    }

    const cap = node.capability ? getCapability(node.capability) : undefined;
    if (
      cap?.confirmationPolicy === "required_before_execute" &&
      node.type !== "confirmation" &&
      node.type !== "action"
    ) {
      errors.push({
        nodeId: node.id,
        code: "side_effect_unprotected",
        message: `Capability ${node.capability} requires a confirmation node`,
      });
    }
  }

  // Reachability from entry
  if (def.entryNodeId && byId.has(def.entryNodeId)) {
    const reachable = new Set<string>();
    const stack = [def.entryNodeId];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      const node = byId.get(id);
      for (const edge of node?.transitions || []) {
        if (!reachable.has(edge.to)) stack.push(edge.to);
      }
    }
    for (const node of def.nodes) {
      if (!reachable.has(node.id) && node.id !== def.entryNodeId) {
        errors.push({
          nodeId: node.id,
          code: "unreachable_node",
          message: `Node ${node.id} is not reachable from entry`,
        });
      }
    }
  }

  return errors;
}

export function assertValidWorkflowDefinition(def: WorkflowDefinition): void {
  const errors = validateWorkflowDefinition(def);
  if (errors.length) {
    throw new Error(
      `Invalid workflow ${def.id} v${def.version}: ${errors.map((e) => e.message).join("; ")}`,
    );
  }
}
