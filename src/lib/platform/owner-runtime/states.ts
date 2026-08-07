/**
 * Owner Amy state-driven tool exposure.
 * The LLM only sees tools relevant to the current owner task.
 */
import type { OwnerTask } from "./session";

export type OwnerWorkflowState = OwnerTask;

/** Read/diagnostic tools available in most states. */
const DIAGNOSTIC_TOOLS = [
  "get_agent_status",
  "get_agent_configuration",
  "get_recent_agent_errors",
  "get_call_trace",
  "get_workflow_definition",
  "get_workflow_version_history",
  "get_integration_health",
  "get_test_results",
  "get_agent_overview",
  "get_agent_health",
  "explain_call_failure",
  "get_execution_trace",
] as const;

/** Change workflow tools. */
const CHANGE_TOOLS = [
  "create_change_request",
  "request_workflow_build",
  "list_change_proposals",
  "get_workflow_draft",
  "list_workflow_drafts",
  "validate_workflow_draft",
] as const;

/** Publish/rollback tools — gated by tests + permissions. */
const PUBLISH_TOOLS = [
  "request_publish",
  "request_rollback",
  "request_agent_test",
  "request_workflow_tests",
  "confirm_change_proposal",
  "promote_workflow_draft",
  "request_version_activation",
  "rollback_version",
] as const;

/** Safe settings that don't require workflow architect. */
const SAFE_SETTING_TOOLS = [
  "update_safe_agent_setting",
  "enable_agent",
  "disable_agent",
  "pause_agent",
  "resume_agent",
] as const;

export const OWNER_STATE_ALLOWED_TOOLS: Record<OwnerWorkflowState, readonly string[]> = {
  GENERAL: [...DIAGNOSTIC_TOOLS, "create_change_request"],
  DIAGNOSE: [...DIAGNOSTIC_TOOLS],
  CHANGE_REQUEST: [...DIAGNOSTIC_TOOLS, ...CHANGE_TOOLS, ...SAFE_SETTING_TOOLS],
  WORKFLOW_BUILD: [...DIAGNOSTIC_TOOLS, ...CHANGE_TOOLS],
  TEST: [...DIAGNOSTIC_TOOLS, "request_agent_test", "get_test_results", "run_simulation"],
  PUBLISH: [...DIAGNOSTIC_TOOLS, "get_test_results", ...PUBLISH_TOOLS],
  ROLLBACK: [...DIAGNOSTIC_TOOLS, "request_rollback", "rollback_version"],
};

/** Map legacy Owner Amy LLM tool names to canonical gateway names. */
export const OWNER_TOOL_ALIASES: Record<string, string> = {
  get_agent_overview: "get_agent_status",
  get_agent_settings: "get_agent_configuration",
  get_agent_resources: "get_agent_status",
  get_versions: "get_workflow_version_history",
  get_current_version: "get_workflow_version_history",
  search_failures: "get_recent_agent_errors",
  get_pending_attention: "get_recent_agent_errors",
  request_workflow_draft: "request_workflow_build",
  create_booking_policy_proposal: "create_change_request",
  create_collection_field_proposal: "create_change_request",
  propose_setup_change: "create_change_request",
  confirm_version_activation: "request_publish",
  request_rollback: "request_rollback",
};

export function canonicalOwnerTool(tool: string): string {
  return OWNER_TOOL_ALIASES[tool] || tool;
}

export function toolsForOwnerState(state: OwnerWorkflowState): string[] {
  return [...OWNER_STATE_ALLOWED_TOOLS[state]];
}

export function isOwnerToolAllowedForState(state: OwnerWorkflowState, tool: string): boolean {
  const canonical = canonicalOwnerTool(tool);
  const allowed = OWNER_STATE_ALLOWED_TOOLS[state];
  return allowed.includes(canonical) || allowed.includes(tool);
}

export function inferOwnerTaskFromIntent(intent: string): OwnerWorkflowState {
  const lower = intent.toLowerCase();
  if (/why did|fail|error|didn't book|trace|diagnos/.test(lower)) return "DIAGNOSE";
  if (/publish|deploy|turn on|activate|go live|confirm_change|promote_workflow|version_activation/.test(lower)) return "PUBLISH";
  if (/rollback|put it back|revert|undo/.test(lower)) return "ROLLBACK";
  if (/test|simulation|regression/.test(lower)) return "TEST";
  if (/workflow|flow|build|change.*field|stop asking|make.*optional|proposal/.test(lower)) {
    return "CHANGE_REQUEST";
  }
  return "GENERAL";
}
