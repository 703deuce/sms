import type { WorkflowDefinition, WorkflowNode } from "./schema";

/** Maps declarative workflow nodes to LiveKit-style task labels for observability. */
export function taskLabelForNode(node: WorkflowNode, workflow: WorkflowDefinition): string {
  const prefix = workflow.id.replace(/[^a-z0-9]+/gi, "_");
  return `${prefix}__${node.id}`;
}

/**
 * Ordered node ids for a linear voice path — used when wiring LiveKit TaskGroup tasks.
 * Skips trigger-only architect nodes; voice runtime starts at entryNodeId.
 */
export function linearVoiceNodePath(workflow: WorkflowDefinition): string[] {
  const visited = new Set<string>();
  const path: string[] = [];
  let nodeId: string | null = workflow.entryNodeId;

  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId);
    path.push(nodeId);
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node?.transitions.length) break;
    nodeId = node.transitions[0]?.to || null;
  }

  return path;
}

export type WorkflowTaskDescriptor = {
  nodeId: string;
  taskLabel: string;
  requiresUserInput: boolean;
  capability?: string;
};

export function describeWorkflowTasks(workflow: WorkflowDefinition): WorkflowTaskDescriptor[] {
  return workflow.nodes.map((node) => ({
    nodeId: node.id,
    taskLabel: taskLabelForNode(node, workflow),
    requiresUserInput: Boolean(node.requiresUserInput),
    capability: node.capability,
  }));
}
