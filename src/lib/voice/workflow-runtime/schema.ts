import type { BuilderFieldType } from "@/lib/voice/field-runtime/types";

export const WORKFLOW_DEFINITION_VERSION = 1 as const;

/** Generic node types — business behavior comes from configuration. */
export type WorkflowNodeType =
  | "conversation"
  | "collect_fields"
  | "action"
  | "choice"
  | "condition"
  | "confirmation"
  | "handoff"
  | "completion";

export type WorkflowFieldSpec = {
  id: string;
  type: BuilderFieldType;
  required: boolean;
  label: string;
  instruction: string;
};

export type WorkflowTransition = {
  /** Target node id */
  to: string;
  /** Condition key evaluated against runtime state; omit for default edge */
  when?: "default" | "fields_complete" | "confirmation_received" | "emergency" | "normal" | "book_intent" | "reschedule_intent" | "cancel_intent";
};

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  description?: string;
  instructions?: string;
  fields?: WorkflowFieldSpec[];
  /** Capability id from CAPABILITY_REGISTRY, e.g. calendar.check_availability */
  capability?: string;
  /**
   * When true, the model turn should stop after this node until the caller speaks again.
   * Used by the turn-envelope compiler to bound same-turn tool chaining.
   */
  requiresUserInput?: boolean;
  requiresExplicitConfirmation?: boolean;
  transitions: WorkflowTransition[];
  metadata?: Record<string, unknown>;
};

export type WorkflowGlobalPolicies = {
  alwaysAllow?: string[];
  maxToolStepsPerTurn?: number;
};

export type WorkflowDefinition = {
  schemaVersion: typeof WORKFLOW_DEFINITION_VERSION;
  id: string;
  workspaceId?: string;
  agentId?: string;
  version: number;
  name: string;
  description?: string;
  entryNodeId: string;
  nodes: WorkflowNode[];
  globalPolicies?: WorkflowGlobalPolicies;
  metadata?: Record<string, unknown>;
};

export type WorkflowValidationError = {
  code: string;
  message: string;
  nodeId?: string;
};

export type WorkflowRuntimeSnapshot = {
  workflowId: string;
  workflowVersion: number;
  currentNodeId: string;
  collectedFields: Record<string, string>;
  confirmationReceived: boolean;
  /** Derived flags for condition edges */
  flags: Record<string, unknown>;
};

export type TurnToolEnvelope = {
  currentNodeId: string;
  capabilityIds: string[];
  toolNames: string[];
  taskInstructions: string;
  /** Nodes visited while compiling this envelope (observability) */
  visitedNodeIds: string[];
  stoppedAtUserBoundary: boolean;
  stoppedAtNodeId: string | null;
};
