/**
 * Patch-first workflow modification — apply operations to a base graph copy.
 */

import type {
  WorkflowDraft,
  WorkflowDraftEdge,
  WorkflowDraftNode,
} from "@/lib/agents/appointment-booking/workflow-validator";
import { isAllowedAppointmentBlock } from "@/lib/agents/appointment-booking/workflow-blocks";

export type WorkflowPatchOperation =
  | { op: "add_node"; node: WorkflowDraftNode }
  | { op: "update_node"; nodeId: string; changes: Record<string, unknown> }
  | { op: "remove_node"; nodeId: string }
  | { op: "add_edge"; edge: WorkflowDraftEdge }
  | { op: "remove_edge"; fromNodeId: string; toNodeId: string; condition?: string };

export type WorkflowPatch = {
  baseVersionId: string;
  operations: WorkflowPatchOperation[];
};

export function cloneWorkflowDraft(draft: WorkflowDraft): WorkflowDraft {
  return JSON.parse(JSON.stringify(draft)) as WorkflowDraft;
}

export function emptyBaseWorkflow(input: {
  agentId: string;
  name: string;
  sourceRequest: string;
  phoneNumberId?: string;
}): WorkflowDraft {
  const trigger: WorkflowDraftNode = {
    id: "trigger",
    type: "inbound_call",
    config: { phoneNumberId: input.phoneNumberId || "" },
  };
  return {
    id: `draft_${Date.now()}`,
    agentId: input.agentId,
    name: input.name,
    version: 1,
    triggerNodeId: "trigger",
    nodes: [trigger],
    edges: [],
    validationStatus: "not_validated",
    validationErrors: [],
    requiresConfirmation: true,
    status: "draft",
    createdAt: new Date().toISOString(),
    sourceRequest: input.sourceRequest,
  };
}

export function applyWorkflowPatch(
  base: WorkflowDraft,
  patch: WorkflowPatch,
): { draft: WorkflowDraft; addedNodeIds: string[]; updatedNodeIds: string[]; removedNodeIds: string[] } {
  const draft = cloneWorkflowDraft(base);
  const addedNodeIds: string[] = [];
  const updatedNodeIds: string[] = [];
  const removedNodeIds: string[] = [];

  for (const op of patch.operations) {
    switch (op.op) {
      case "add_node": {
        if (!isAllowedAppointmentBlock(op.node.type)) {
          throw new Error(`Unknown block type: ${op.node.type}`);
        }
        if (draft.nodes.some((n) => n.id === op.node.id)) {
          throw new Error(`Node id already exists: ${op.node.id}`);
        }
        draft.nodes.push(op.node);
        addedNodeIds.push(op.node.id);
        break;
      }
      case "update_node": {
        const idx = draft.nodes.findIndex((n) => n.id === op.nodeId);
        if (idx < 0) throw new Error(`Node not found: ${op.nodeId}`);
        draft.nodes[idx] = {
          ...draft.nodes[idx],
          config: { ...draft.nodes[idx].config, ...op.changes },
          ...(op.changes.type && typeof op.changes.type === "string"
            ? { type: op.changes.type }
            : {}),
        };
        updatedNodeIds.push(op.nodeId);
        break;
      }
      case "remove_node": {
        draft.nodes = draft.nodes.filter((n) => n.id !== op.nodeId);
        draft.edges = draft.edges.filter(
          (e) => e.fromNodeId !== op.nodeId && e.toNodeId !== op.nodeId,
        );
        if (draft.triggerNodeId === op.nodeId) {
          throw new Error("Cannot remove trigger node without setting a new trigger");
        }
        removedNodeIds.push(op.nodeId);
        break;
      }
      case "add_edge": {
        draft.edges.push(op.edge);
        break;
      }
      case "remove_edge": {
        draft.edges = draft.edges.filter(
          (e) =>
            !(
              e.fromNodeId === op.fromNodeId &&
              e.toNodeId === op.toNodeId &&
              (op.condition == null || e.condition === op.condition)
            ),
        );
        break;
      }
      default:
        break;
    }
  }

  return { draft, addedNodeIds, updatedNodeIds, removedNodeIds };
}

export function graphDiff(
  before: WorkflowDraft,
  after: WorkflowDraft,
): {
  unchangedNodeIds: string[];
  addedNodeIds: string[];
  updatedNodeIds: string[];
  removedNodeIds: string[];
  addedEdges: WorkflowDraftEdge[];
  removedEdges: WorkflowDraftEdge[];
} {
  const beforeIds = new Set(before.nodes.map((n) => n.id));
  const afterIds = new Set(after.nodes.map((n) => n.id));
  const addedNodeIds = [...afterIds].filter((id) => !beforeIds.has(id));
  const removedNodeIds = [...beforeIds].filter((id) => !afterIds.has(id));
  const updatedNodeIds = after.nodes
    .filter((n) => {
      const prev = before.nodes.find((b) => b.id === n.id);
      return prev && JSON.stringify(prev) !== JSON.stringify(n);
    })
    .map((n) => n.id);
  const unchangedNodeIds = after.nodes
    .filter((n) => beforeIds.has(n.id) && !updatedNodeIds.includes(n.id))
    .map((n) => n.id);

  const edgeKey = (e: WorkflowDraftEdge) =>
    `${e.fromNodeId}|${e.toNodeId}|${e.condition || ""}`;
  const beforeEdgeKeys = new Set(before.edges.map(edgeKey));
  const afterEdgeKeys = new Set(after.edges.map(edgeKey));
  const addedEdges = after.edges.filter((e) => !beforeEdgeKeys.has(edgeKey(e)));
  const removedEdges = before.edges.filter((e) => !afterEdgeKeys.has(edgeKey(e)));

  return {
    unchangedNodeIds,
    addedNodeIds,
    updatedNodeIds,
    removedNodeIds,
    addedEdges,
    removedEdges,
  };
}
