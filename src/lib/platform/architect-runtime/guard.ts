/**
 * Workflow Architect tool guard — Architect cannot publish or call blocked tools.
 */
import { isPlatformBlockedTool } from "../agent-runtime/gateway";

export const ARCHITECT_ALLOWED_TOOLS = [
  "list_node_catalog",
  "get_node_schema",
  "build_workflow_candidate",
  "validate_workflow_candidate",
  "submit_workflow_candidate",
  "get_validator_feedback",
] as const;

export const ARCHITECT_BLOCKED_TOOLS = [
  "request_publish",
  "publish_version",
  "activate_flow",
  "deploy_code",
  "write_workflow_json",
  ...Array.from(["execute_sql", "update_database_row"]),
] as const;

export function isArchitectToolAllowed(tool: string): boolean {
  if (isPlatformBlockedTool(tool)) return false;
  if ((ARCHITECT_BLOCKED_TOOLS as readonly string[]).includes(tool)) return false;
  return (ARCHITECT_ALLOWED_TOOLS as readonly string[]).includes(tool);
}

export function assertArchitectToolAllowed(tool: string): void {
  if (!isArchitectToolAllowed(tool)) {
    throw new Error(`Architect tool not allowed: ${tool}`);
  }
}
