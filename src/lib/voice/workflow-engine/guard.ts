import { computeWorkflowState } from "./engine";
import { canonicalToolType, isToolAllowedForState, IRREVERSIBLE_TOOLS } from "./states";
import type { ToolGuardResult } from "./types";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";

/** Tools that bypass workflow state guards (meta + introspection). */
const GUARD_EXEMPT = new Set([
  "get_runtime_context",
  "get_workflow_requirements",
  "check_customer_fields",
  "check_field_requirements",
]);

export async function assertToolAllowed(input: {
  callId?: string;
  workspaceId: string;
  agentId?: string;
  toolType: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<ToolGuardResult> {
  const canonical = canonicalToolType(input.toolType);

  if (!input.callId) {
    return { allowed: true, state: "GENERAL", allowed_tools: [] };
  }

  if (GUARD_EXEMPT.has(canonical) || GUARD_EXEMPT.has(input.toolType)) {
    const { state } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow: input.workflow,
      serviceName: input.serviceName,
    });
    const { toolsForState } = await import("./states");
    return { allowed: true, state, allowed_tools: toolsForState(state) };
  }

  const { state, runtime } = await computeWorkflowState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: input.workflow,
    serviceName: input.serviceName,
  });

  const { toolsForState } = await import("./states");
  const allowed_tools = toolsForState(state);

  if (state === "BOOKING_IN_PROGRESS" && !["book_appointment", "get_runtime_context"].includes(canonical)) {
    return {
      allowed: false,
      state,
      allowed_tools,
      error_code: "BOOKING_IN_PROGRESS",
      speak:
        "I'm still confirming your appointment. One moment please.",
      retryable: true,
      next_action: "Wait for book_appointment to complete, then respond to the caller.",
    };
  }

  if (!isToolAllowedForState(state, input.toolType)) {
    return {
      allowed: false,
      state,
      allowed_tools,
      error_code: "TOOL_NOT_ALLOWED_FOR_STATE",
      speak: `I can't do that step right now. Current phase: ${state.replace(/_/g, " ").toLowerCase()}.`,
      retryable: false,
      next_action: `Use one of: ${allowed_tools.slice(0, 6).join(", ")}`,
    };
  }

  if (IRREVERSIBLE_TOOLS.has(canonical) && runtime.pending_operations.length > 0 && canonical !== "book_appointment") {
    return {
      allowed: false,
      state,
      allowed_tools,
      error_code: "PENDING_OPERATION",
      speak: "I'm finishing another action first. One moment.",
      retryable: true,
    };
  }

  return { allowed: true, state, allowed_tools };
}
