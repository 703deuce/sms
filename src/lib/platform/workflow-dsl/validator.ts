/**
 * Workflow validation pipeline — Architect candidates must pass all stages.
 */
import { getNodeCatalogEntry, isRegisteredNodeType, sideEffectingNodeTypes } from "./node-catalog";
import type {
  CanonicalWorkflowSpec,
  WorkflowValidationError,
  WorkflowValidationResult,
} from "./types";

const SIDE_EFFECT_TYPES = new Set(sideEffectingNodeTypes());

export function validateCanonicalWorkflow(
  spec: CanonicalWorkflowSpec,
  context?: {
    known_field_ids?: Set<string>;
    connected_integrations?: Set<string>;
    transfer_destinations?: Set<string>;
  },
): WorkflowValidationResult {
  const errors: WorkflowValidationError[] = [];
  const warnings: WorkflowValidationError[] = [];
  const nodeIds = new Set(spec.nodes.map((n) => n.id));
  const ctx = context || {};

  // Schema / empty
  if (!spec.workflow_id) {
    errors.push({ code: "MISSING_WORKFLOW_ID", message: "workflow_id is required" });
  }
  if (!spec.nodes.length) {
    errors.push({ code: "EMPTY_GRAPH", message: "Workflow has no nodes" });
  }
  if (!spec.entry_node || !nodeIds.has(spec.entry_node)) {
    errors.push({ code: "INVALID_ENTRY", message: "entry_node must reference an existing node" });
  }

  // Node catalog validation
  for (const node of spec.nodes) {
    if (!isRegisteredNodeType(node.type)) {
      errors.push({
        code: "UNKNOWN_NODE",
        message: `Node type "${node.type}" is not in the registered catalog`,
        node_id: node.id,
      });
      continue;
    }
    const entry = getNodeCatalogEntry(node.type)!;
    for (const input of entry.required_inputs) {
      const val = node.config[input] ?? node.config[input.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
      if (val == null || val === "") {
        errors.push({
          code: "MISSING_REQUIRED_INPUT",
          message: `Node ${node.id} (${node.type}) missing required input: ${input}`,
          node_id: node.id,
        });
      }
    }
    if (node.type === "collect_field" || node.type === "record_field") {
      const fieldId = String(node.config.field_id || node.config.fieldId || "");
      if (ctx.known_field_ids && fieldId && !ctx.known_field_ids.has(fieldId)) {
        errors.push({
          code: "FIELD_NOT_FOUND",
          message: `Unknown field_id: ${fieldId}`,
          node_id: node.id,
        });
      }
    }
    if (node.type === "integration_available") {
      const provider = String(node.config.provider || "");
      if (ctx.connected_integrations && provider && !ctx.connected_integrations.has(provider)) {
        errors.push({
          code: "INTEGRATION_UNAVAILABLE",
          message: `Integration ${provider} is not connected`,
          node_id: node.id,
        });
      }
    }
    if (node.type === "transfer" || node.type === "escalate") {
      const dest = String(node.config.destination || node.config.to || "");
      if (ctx.transfer_destinations && dest && !ctx.transfer_destinations.has(dest)) {
        errors.push({
          code: "TRANSFER_TARGET_MISSING",
          message: `Transfer destination "${dest}" does not exist`,
          node_id: node.id,
        });
      }
    }
    if (entry.requires_failure_path && SIDE_EFFECT_TYPES.has(node.type)) {
      if (!node.on_failure?.length) {
        errors.push({
          code: "MISSING_FAILURE_PATH",
          message: `Side-effecting node ${node.id} (${node.type}) requires on_failure routes`,
          node_id: node.id,
        });
      }
    }
  }

  // Graph validation — references
  for (const node of spec.nodes) {
    if (node.next && !nodeIds.has(node.next)) {
      errors.push({
        code: "INVALID_NEXT",
        message: `Node ${node.id} points to missing next: ${node.next}`,
        node_id: node.id,
      });
    }
    for (const route of node.on_failure || []) {
      if (!nodeIds.has(route.next_node_id)) {
        errors.push({
          code: "INVALID_FAILURE_ROUTE",
          message: `Node ${node.id} failure route points to missing node: ${route.next_node_id}`,
          node_id: node.id,
        });
      }
    }
  }

  // Reachability
  const reachable = new Set<string>();
  const queue = spec.entry_node ? [spec.entry_node] : [];
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = spec.nodes.find((n) => n.id === id);
    if (!node) continue;
    if (node.next) queue.push(node.next);
    for (const r of node.on_failure || []) queue.push(r.next_node_id);
  }
  for (const node of spec.nodes) {
    if (!reachable.has(node.id)) {
      warnings.push({
        code: "UNREACHABLE_NODE",
        message: `Node ${node.id} is unreachable from entry`,
        node_id: node.id,
      });
    }
  }

  // Cycle detection (simple DFS)
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function hasCycle(id: string): boolean {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const node = spec.nodes.find((n) => n.id === id);
    const nexts = [
      ...(node?.next ? [node.next] : []),
      ...(node?.on_failure?.map((r) => r.next_node_id) || []),
    ];
    for (const next of nexts) {
      if (hasCycle(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }
  if (spec.entry_node && hasCycle(spec.entry_node)) {
    errors.push({ code: "CYCLE_DETECTED", message: "Workflow contains a cycle" });
  }

  // Booking before fields ordering heuristic
  const bookingIdx = spec.nodes.findIndex((n) => n.type === "confirm_booking");
  const collectIdx = spec.nodes.findIndex((n) => n.type === "collect_field");
  if (bookingIdx >= 0 && collectIdx >= 0 && bookingIdx < collectIdx) {
    errors.push({
      code: "BOOKING_BEFORE_FIELDS",
      message: "confirm_booking appears before collect_field in node order",
      node_id: spec.nodes[bookingIdx].id,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export const MAX_ARCHITECT_REPAIR_ATTEMPTS = 3;

export type ArchitectRepairResult =
  | { status: "valid"; spec: CanonicalWorkflowSpec }
  | { status: "build_failed"; error_code: "UNRESOLVED_WORKFLOW_VALIDATION"; details: WorkflowValidationError[] }
  | { status: "capability_not_supported"; error_code: "CAPABILITY_NOT_SUPPORTED"; message: string };

export function assertValidWorkflowOrFail(
  spec: CanonicalWorkflowSpec,
  context?: Parameters<typeof validateCanonicalWorkflow>[1],
): ArchitectRepairResult {
  const result = validateCanonicalWorkflow(spec, context);
  if (result.valid) return { status: "valid", spec };
  const hasUnknown = result.errors.some((e) => e.code === "UNKNOWN_NODE");
  if (hasUnknown) {
    return {
      status: "capability_not_supported",
      error_code: "CAPABILITY_NOT_SUPPORTED",
      message: "Workflow uses unsupported node types — requires product development",
    };
  }
  return {
    status: "build_failed",
    error_code: "UNRESOLVED_WORKFLOW_VALIDATION",
    details: result.errors,
  };
}
