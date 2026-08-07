import { buildRuntimeContext, computeWorkflowState } from "./engine";
import { deriveNextAction } from "./next-action";
import { isSchedulingGatedTool } from "./scheduling-tools";
import { canonicalToolType, isToolAllowedForState, IRREVERSIBLE_TOOLS, toolsForState } from "./states";
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
    if (isSchedulingGatedTool(canonical) || isSchedulingGatedTool(input.toolType)) {
      return {
        allowed: false,
        state: "COLLECTING_FIELDS",
        allowed_tools: toolsForState("COLLECTING_FIELDS"),
        error_code: "TOOL_NOT_ALLOWED_FOR_STATE",
        speak: "I need a few details from you before I can check the calendar.",
        retryable: false,
        next_action: "Collect required fields with record_current_field first.",
      };
    }
    if (!GUARD_EXEMPT.has(canonical) && !GUARD_EXEMPT.has(input.toolType)) {
      return {
        allowed: false,
        state: "COLLECTING_FIELDS",
        allowed_tools: toolsForState("COLLECTING_FIELDS"),
        error_code: "CALL_CONTEXT_REQUIRED",
        speak: "I'm still connecting your call. One moment please.",
        retryable: true,
      };
    }
    return { allowed: true, state: "COLLECTING_FIELDS", allowed_tools: toolsForState("COLLECTING_FIELDS") };
  }

  if (GUARD_EXEMPT.has(canonical) || GUARD_EXEMPT.has(input.toolType)) {
    const { state } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow: input.workflow,
      serviceName: input.serviceName,
    });
    const { toolsForState: _tfs } = await import("./states");
    return { allowed: true, state, allowed_tools: _tfs(state) };
  }

  const { state, runtime } = await computeWorkflowState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow: input.workflow,
    serviceName: input.serviceName,
  });

  const { getActiveWriteLock } = await import("./write-lock");
  const writeLock = await getActiveWriteLock(input.callId);
  if (
    writeLock &&
    writeLock.tool !== canonical &&
    !["book_appointment", "get_runtime_context"].includes(canonical)
  ) {
    return {
      allowed: false,
      state,
      allowed_tools: toolsForState(state),
      error_code: "WRITE_IN_PROGRESS",
      speak: "I'm still finishing another action. One moment please.",
      retryable: true,
      next_action: `Wait for ${writeLock.tool} to complete.`,
    };
  }

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
    let current_field = null;
    let workflow_complete = false;
    let next_action = `Use one of: ${allowed_tools.slice(0, 6).join(", ")}`;

    if (input.callId) {
      try {
        const ctx = await buildRuntimeContext({
          callId: input.callId,
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          workflow: input.workflow,
          serviceName: input.serviceName,
        });
        current_field = ctx.current_field;
        workflow_complete = ctx.workflow_complete;
        next_action =
          ctx.next_action ||
          deriveNextAction({
            state,
            complete: ctx.workflow_complete,
            currentField: ctx.current_field,
            missingFields: ctx.missing_fields,
          }) ||
          next_action;
      } catch {
        // fall back to generic recovery
      }
    }

    const isSchedulingBlocked =
      isSchedulingGatedTool(canonical) && (state === "COLLECTING_FIELDS" || state === "INTENT_DISCOVERY");

    return {
      allowed: false,
      state,
      allowed_tools,
      error_code: "TOOL_NOT_ALLOWED_FOR_STATE",
      speak: isSchedulingBlocked
        ? "I still need a few details before I can check the calendar."
        : `I can't do that step right now. Current phase: ${state.replace(/_/g, " ").toLowerCase()}.`,
      retryable: false,
      next_action,
      current_field,
      workflow_complete,
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
