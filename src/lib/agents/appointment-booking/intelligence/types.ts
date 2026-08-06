/**
 * Amy agent intelligence — shared runtime, capability, and result types.
 */

import type {
  WorkflowDraftEdge,
  WorkflowDraftNode,
} from "@/lib/agents/appointment-booking/workflow-validator";

export type AgentRole =
  | "owner_controller"
  | "caller_booking"
  | "workflow_architect"
  | "diagnostic";

export type AgentRuntimeId =
  | "owner_amy"
  | "caller_amy"
  | "appointment_workflow_architect"
  | "diagnostic_specialist";

export type AgentRuntimeDefinition = {
  runtimeId: AgentRuntimeId;
  agentRole: AgentRole;
  label: string;
  purpose: string;
  promptSource: string;
  promptVersion: string;
  modelProvider: string;
  modelName: string;
  toolIds: string[];
  contextSources: string[];
  allowedWrites: string[];
  prohibitedActions: string[];
  timeoutMs: number;
  fallbackRuntimeId?: AgentRuntimeId;
  maxContextBudget: number;
  retrievalPolicy: string;
};

export type AgentCapabilityCategory =
  | "read"
  | "diagnose"
  | "configure"
  | "workflow"
  | "test"
  | "deploy"
  | "knowledge"
  | "duplicate";

export type AgentCapability = {
  id: string;
  label: string;
  description: string;
  category: AgentCapabilityCategory;
  requiredTools: string[];
  requiredPermissions: string[];
  requiredResources: string[];
  riskLevel: "low" | "medium" | "high";
  confirmationRequired: boolean;
};

export type OwnerRequestIntent =
  | "read_information"
  | "explain_activity"
  | "diagnose_failure"
  | "change_configuration"
  | "build_workflow"
  | "run_test"
  | "deploy_version"
  | "duplicate_agent"
  | "manage_knowledge"
  | "restricted_or_unsupported";

export type ToolDescription = {
  id: string;
  purpose: string;
  useWhen: string[];
  doNotUseWhen: string[];
  requiredInputs: string[];
  returns: string[];
  sideEffects: "none" | "proposal" | "draft" | "queued_job" | "production_write";
};

export type WorkflowArchitectResult = {
  status: "draft_created" | "needs_information" | "unsupported";
  summary: string;
  requiredResources: string[];
  missingInformation: string[];
  nodes: WorkflowDraftNode[];
  edges: WorkflowDraftEdge[];
  changedNodes: string[];
  removedNodes: string[];
  invariantsChecked: string[];
  risks: Array<{
    code: string;
    level: "low" | "medium" | "high";
    description: string;
  }>;
  requiredTests: string[];
  draftId?: string;
};

export type DiagnosticResult = {
  firstFailure: {
    step: string;
    errorCode?: string;
    errorMessage?: string;
  } | null;
  failureLayer:
    | "temporary"
    | "configuration"
    | "provider"
    | "data"
    | "user"
    | "unknown";
  affectedNodeOrTool?: string;
  retrySafe: boolean;
  degradedMode: boolean;
  affectedCalls: string[];
  ownerExplanation: string;
  recommendedNextAction: string;
  evidenceSufficient: boolean;
};

export type OwnerDecisionLoopLimits = {
  maxPlanningIterations: number;
  maxSpecialistCalls: number;
  timeoutMs: number;
};

export const DEFAULT_OWNER_LOOP_LIMITS: OwnerDecisionLoopLimits = {
  maxPlanningIterations: 8,
  maxSpecialistCalls: 2,
  timeoutMs: 45_000,
};

export type OwnerRuntimeContext = {
  agentName: string;
  businessName: string;
  workspaceId: string;
  agentId: string;
  agentVersionId?: string | null;
  userPermissionLevel: "owner" | "admin" | "member" | "anonymous";
  localDateTime: string;
  timezone: string;
};

export type PromptModuleId =
  | "base_identity"
  | "safety_and_permissions"
  | "capability_catalog"
  | "request_routing"
  | "proposal_policy"
  | "workflow_delegation_policy"
  | "testing_policy"
  | "deployment_policy"
  | "response_style"
  | "base_receptionist"
  | "booking_policy"
  | "date_time_policy"
  | "custom_fields"
  | "tool_policy"
  | "transfer_policy"
  | "fallback_policy"
  | "knowledge_policy"
  | "workflow_architect_base"
  | "workflow_architect_invariants"
  | "diagnostic_base";

export type PromptVersionRecord = {
  runtimeId: AgentRuntimeId;
  promptVersion: string;
  hash: string;
  deployedAt: string;
  model: string;
  toolSchemaVersion: string;
  regressionSuiteResult?: "passed" | "failed" | "pending";
};
