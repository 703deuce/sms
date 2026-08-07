/**
 * Shared Transovo agent tool gateway — authentication, permissions, schema checks,
 * idempotency, receipts, and normalized errors for all agent roles.
 */
import { PlatformToolError } from "./errors";
import { createReceipt, newOperationId } from "./receipts";
import type {
  AgentRole,
  PlatformPermission,
  PlatformToolResult,
} from "./types";

export type GatewayToolSpec = {
  tool: string;
  risk: "read" | "low" | "medium" | "high";
  permissions: PlatformPermission[];
  requiresConfirmation?: boolean;
  /** Blocked tools are never callable by LLM (e.g. execute_sql). */
  blocked?: boolean;
};

export type GatewayContext = {
  agent_role: AgentRole;
  tenant_id: string;
  user_id: string;
  permissions: PlatformPermission[];
  session_id?: string;
  operation_id?: string;
};

export function assertGatewayPermission(
  ctx: GatewayContext,
  spec: GatewayToolSpec,
): void {
  if (spec.blocked) {
    throw new PlatformToolError(
      "TOOL_NOT_ALLOWED",
      `Tool ${spec.tool} is not exposed to LLM agents`,
      false,
      "That action is not available.",
    );
  }
  for (const perm of spec.permissions) {
    if (!ctx.permissions.includes(perm)) {
      throw new PlatformToolError(
        "PERMISSION_DENIED",
        `Missing permission ${perm} for ${spec.tool}`,
        false,
        "You don't have permission for that action.",
      );
    }
  }
}

export function gatewaySuccess<T extends Record<string, unknown>>(input: {
  ctx: GatewayContext;
  tool: string;
  status?: PlatformToolResult["status"];
  operation_id?: string;
  data: T;
  user_message?: string;
}): PlatformToolResult<T> {
  const operation_id = input.operation_id || input.ctx.operation_id || newOperationId();
  const receipt = createReceipt({
    operation_id,
    type: input.tool,
    status: input.status || "confirmed",
    agent_role: input.ctx.agent_role,
    tenant_id: input.ctx.tenant_id,
    user_id: input.ctx.user_id,
  });
  return {
    success: true,
    operation_id,
    status: receipt.status,
    data: input.data,
    user_message: input.user_message,
    receipt,
  };
}

export function gatewayBlocked(input: {
  ctx: GatewayContext;
  tool: string;
  code: PlatformToolResult["error_code"];
  message: string;
  user_message?: string;
  retryable?: boolean;
}): PlatformToolResult {
  return {
    success: false,
    operation_id: input.ctx.operation_id || newOperationId(),
    status: "blocked",
    error_code: input.code,
    user_message: input.user_message || input.message,
    retryable: input.retryable,
    data: {},
  };
}

/** Tools that must never be exposed to any LLM agent. */
export const PLATFORM_BLOCKED_TOOLS = new Set([
  "execute_sql",
  "edit_prompt_text",
  "write_workflow_json",
  "update_database_row",
  "call_calendly_api",
  "modify_telnyx_webhook",
  "deploy_code",
  "raw_prisma",
]);

export function isPlatformBlockedTool(tool: string): boolean {
  return PLATFORM_BLOCKED_TOOLS.has(tool);
}
