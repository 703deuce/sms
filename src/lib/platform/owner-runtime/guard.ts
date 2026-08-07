import { PlatformToolError } from "../agent-runtime/errors";
import type { PlatformPermission } from "../agent-runtime/types";
import { isPlatformBlockedTool } from "../agent-runtime/gateway";
import {
  canonicalOwnerTool,
  isOwnerToolAllowedForState,
  toolsForOwnerState,
  type OwnerWorkflowState,
} from "./states";

export type OwnerGuardResult = {
  allowed: boolean;
  state: OwnerWorkflowState;
  allowed_tools: string[];
  error_code?: string;
  user_message?: string;
  retryable?: boolean;
};

export function assertOwnerToolAllowed(input: {
  tool: string;
  state: OwnerWorkflowState;
  permissions: PlatformPermission[];
  tests_passed?: boolean;
  candidate_version?: number | null;
}): OwnerGuardResult {
  const canonical = canonicalOwnerTool(input.tool);
  const allowed_tools = toolsForOwnerState(input.state);

  if (isPlatformBlockedTool(canonical) || isPlatformBlockedTool(input.tool)) {
    return {
      allowed: false,
      state: input.state,
      allowed_tools,
      error_code: "TOOL_NOT_ALLOWED",
      user_message: "That action is not available through Owner Amy.",
    };
  }

  if (!isOwnerToolAllowedForState(input.state, input.tool)) {
    return {
      allowed: false,
      state: input.state,
      allowed_tools,
      error_code: "TOOL_NOT_ALLOWED_FOR_STATE",
      user_message: `I can't do that step right now. Current phase: ${input.state.replace(/_/g, " ").toLowerCase()}.`,
      retryable: false,
    };
  }

  const publishTools = new Set([
    "request_publish",
    "promote_workflow_draft",
    "request_version_activation",
    "confirm_change_proposal",
  ]);
  if (publishTools.has(canonical) && !input.tests_passed) {
    return {
      allowed: false,
      state: input.state,
      allowed_tools: allowed_tools.filter((t) => !publishTools.has(t)),
      error_code: "TESTS_NOT_PASSED",
      user_message: "Tests must pass before publishing.",
      retryable: false,
    };
  }

  if (
    publishTools.has(canonical) &&
    !input.permissions.includes("workflow.publish")
  ) {
    return {
      allowed: false,
      state: input.state,
      allowed_tools,
      error_code: "PERMISSION_DENIED",
      user_message: "You don't have permission to publish workflows.",
    };
  }

  if (
    ["request_rollback", "rollback_version"].includes(canonical) &&
    !input.permissions.includes("workflow.rollback")
  ) {
    return {
      allowed: false,
      state: input.state,
      allowed_tools,
      error_code: "PERMISSION_DENIED",
      user_message: "You don't have permission to roll back.",
    };
  }

  return { allowed: true, state: input.state, allowed_tools };
}

export function assertOwnerToolAllowedOrThrow(
  input: Parameters<typeof assertOwnerToolAllowed>[0],
): OwnerGuardResult {
  const result = assertOwnerToolAllowed(input);
  if (!result.allowed) {
    throw new PlatformToolError(
      (result.error_code as "TOOL_NOT_ALLOWED") || "TOOL_NOT_ALLOWED",
      result.user_message || "Tool not allowed",
      false,
      result.user_message,
    );
  }
  return result;
}
