/**
 * Validate Workflow Architect drafts against the approved block registry.
 * Never accepts arbitrary code or unknown block types.
 */

import {
  getAppointmentWorkflowBlock,
  isAllowedAppointmentBlock,
} from "@/lib/agents/appointment-booking/workflow-blocks";

export type WorkflowDraftNode = {
  id: string;
  type: string;
  config: Record<string, unknown>;
};

export type WorkflowDraftEdge = {
  fromNodeId: string;
  toNodeId: string;
  condition?: string;
};

export type WorkflowDraft = {
  id: string;
  agentId: string;
  name: string;
  version: number;
  triggerNodeId: string;
  nodes: WorkflowDraftNode[];
  edges: WorkflowDraftEdge[];
  validationStatus: "not_validated" | "valid" | "invalid";
  validationErrors: Array<{ nodeId?: string; code: string; message: string }>;
  requiresConfirmation: true;
  status: "draft" | "ready_for_test" | "rejected" | "activated";
  createdAt: string;
  sourceRequest?: string;
};

export function validateWorkflowDraft(draft: WorkflowDraft): WorkflowDraft {
  const errors: WorkflowDraft["validationErrors"] = [];
  const ids = new Set(draft.nodes.map((n) => n.id));

  if (!draft.nodes.length) {
    errors.push({ code: "empty_graph", message: "Workflow has no nodes" });
  }
  if (!draft.triggerNodeId || !ids.has(draft.triggerNodeId)) {
    errors.push({
      code: "missing_trigger",
      message: "triggerNodeId must reference an existing node",
    });
  }

  const trigger = draft.nodes.find((n) => n.id === draft.triggerNodeId);
  if (trigger) {
    const def = getAppointmentWorkflowBlock(trigger.type);
    if (!def || def.category !== "trigger") {
      errors.push({
        nodeId: trigger.id,
        code: "invalid_trigger",
        message: `Node ${trigger.id} is not an approved trigger block`,
      });
    }
  }

  for (const node of draft.nodes) {
    if (!isAllowedAppointmentBlock(node.type)) {
      errors.push({
        nodeId: node.id,
        code: "unknown_block",
        message: `Block type "${node.type}" is not approved for appointment_booking`,
      });
      continue;
    }
    const def = getAppointmentWorkflowBlock(node.type)!;
    for (const rule of def.validationRules) {
      if (rule === "requires_phone_number_id" && !node.config.phoneNumberId) {
        errors.push({
          nodeId: node.id,
          code: rule,
          message: "Inbound trigger requires phoneNumberId",
        });
      }
      if (rule === "requires_timezone" && !node.config.timezone) {
        errors.push({
          nodeId: node.id,
          code: rule,
          message: "resolve_datetime requires timezone",
        });
      }
      if (rule === "requires_allowed_intents") {
        const intents = node.config.allowed_intents || node.config.allowedIntents;
        if (!Array.isArray(intents) || intents.length === 0) {
          errors.push({
            nodeId: node.id,
            code: rule,
            message: "identify_intent requires allowed_intents",
          });
        }
      }
      if (rule === "requires_field_key") {
        const fieldKey = node.config.fieldKey || node.config.field_key;
        const fields = node.config.fields;
        if (
          !fieldKey &&
          !(Array.isArray(fields) && fields.length > 0)
        ) {
          errors.push({
            nodeId: node.id,
            code: rule,
            message: "collect_field requires fieldKey or fields[]",
          });
        }
      }
      if (rule === "max_three_slots") {
        const maxSlots = Number(node.config.maxSlots ?? node.config.max_slots ?? 3);
        if (!Number.isFinite(maxSlots) || maxSlots < 1 || maxSlots > 3) {
          errors.push({
            nodeId: node.id,
            code: rule,
            message: "offer_slots maxSlots must be 1–3",
          });
        }
      }
      if (rule === "requires_final_confirmation") {
        // Graph-level: ensure a confirm_field exists before create_appointment
        const hasConfirm = draft.nodes.some((n) => n.type === "confirm_field");
        if (!hasConfirm) {
          errors.push({
            nodeId: node.id,
            code: rule,
            message: "create_appointment requires a confirm_field node in the graph",
          });
        }
      }
      if (rule === "requires_booking_success_first") {
        const hasCreate = draft.nodes.some((n) => n.type === "create_appointment");
        if (!hasCreate) {
          errors.push({
            nodeId: node.id,
            code: rule,
            message: "send_confirmation_sms requires create_appointment in the graph",
          });
        }
      }
      if (rule === "requires_branches") {
        const branches = node.config.branches;
        if (!branches || typeof branches !== "object") {
          errors.push({
            nodeId: node.id,
            code: rule,
            message: "branch node requires branches config",
          });
        }
      }
    }
  }

  for (const edge of draft.edges) {
    if (!ids.has(edge.fromNodeId) || !ids.has(edge.toNodeId)) {
      errors.push({
        code: "dangling_edge",
        message: `Edge ${edge.fromNodeId} → ${edge.toNodeId} references missing nodes`,
      });
    }
  }

  // Reachability from trigger
  if (draft.triggerNodeId && ids.has(draft.triggerNodeId)) {
    const adj = new Map<string, string[]>();
    for (const e of draft.edges) {
      const list = adj.get(e.fromNodeId) || [];
      list.push(e.toNodeId);
      adj.set(e.fromNodeId, list);
    }
    const seen = new Set<string>();
    const stack = [draft.triggerNodeId];
    while (stack.length) {
      const cur = stack.pop()!;
      if (seen.has(cur)) continue;
      seen.add(cur);
      for (const next of adj.get(cur) || []) stack.push(next);
    }
    for (const id of ids) {
      if (!seen.has(id)) {
        errors.push({
          nodeId: id,
          code: "unreachable_node",
          message: `Node ${id} is unreachable from the trigger`,
        });
      }
    }

    // Simple cycle detection
    const visiting = new Set<string>();
    const visited = new Set<string>();
    let cyclic = false;
    const dfs = (n: string) => {
      if (cyclic) return;
      if (visiting.has(n)) {
        cyclic = true;
        return;
      }
      if (visited.has(n)) return;
      visiting.add(n);
      for (const next of adj.get(n) || []) dfs(next);
      visiting.delete(n);
      visited.add(n);
    };
    dfs(draft.triggerNodeId);
    if (cyclic) {
      errors.push({ code: "cycle", message: "Workflow contains a cycle" });
    }
  }

  // Terminal path: at least one outcome node reachable
  const hasOutcome = draft.nodes.some(
    (n) => getAppointmentWorkflowBlock(n.type)?.category === "outcome",
  );
  if (!hasOutcome) {
    errors.push({
      code: "missing_outcome",
      message: "Workflow must include at least one outcome block",
    });
  }

  // Fallback for tool failures when create_appointment present
  const hasCreate = draft.nodes.some((n) => n.type === "create_appointment");
  const hasFallback =
    draft.nodes.some((n) => n.type === "fallback") ||
    draft.nodes.some((n) => n.type === "take_message") ||
    draft.nodes.some((n) => n.type === "appointment_requested");
  if (hasCreate && !hasFallback) {
    errors.push({
      code: "missing_booking_fallback",
      message:
        "Booking graphs must include fallback / take_message / appointment_requested",
    });
  }

  return {
    ...draft,
    validationStatus: errors.length ? "invalid" : "valid",
    validationErrors: errors,
    status: errors.length ? "draft" : "ready_for_test",
  };
}
