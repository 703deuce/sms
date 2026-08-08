import { recordCurrentField } from "@/lib/voice/field-runtime/save";
import {
  getOrCreateRealtimeSession,
  setSessionFieldFast,
  updateSessionAfterRuntimeChange,
} from "@/lib/voice/realtime-session/init";
import { executeContinueWorkflow } from "@/lib/voice/workflow-engine/continue-workflow";
import { startDomainActionTimer } from "./latency";
import { assertTaskToolAllowed, taskForWorkflowState } from "./task-guard";
import type { LiveKitCallContext } from "./session-bootstrap";

export type DomainActionResult = {
  ok: boolean;
  speak: string;
  workflow_state?: string;
  data?: Record<string, unknown>;
  error_code?: string;
};

export async function domainRecordField(input: {
  ctx: LiveKitCallContext;
  value: string;
  fieldId?: string;
}): Promise<DomainActionResult> {
  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "record_field");
  const timer = startDomainActionTimer("record_field", input.ctx.callId, taskId);

  const fieldId = input.fieldId || input.ctx.session.activeField;
  if (!fieldId) {
    timer.finish(false, "NO_ACTIVE_FIELD");
    return {
      ok: false,
      speak: "I still need some information from you.",
      error_code: "NO_ACTIVE_FIELD",
    };
  }

  const recorded = await recordCurrentField({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    callId: input.ctx.callId,
    value: input.value,
    workflow: "book_appointment",
    serviceName: input.ctx.session.serviceName,
  });
  timer.markProviderEnd();

  if ((recorded as { ok?: boolean }).ok === false) {
    timer.finish(false, "VALIDATION_FAILED");
    return {
      ok: false,
      speak: String((recorded as { speak?: string }).speak || "That value didn't look right."),
      error_code: "VALIDATION_FAILED",
    };
  }

  let session = setSessionFieldFast(input.ctx.session, fieldId, input.value);
  session = await updateSessionAfterRuntimeChange(session, {});
  input.ctx.session = session;
  input.ctx.workflowState = session.currentState;

  return {
    ok: true,
    speak: String((recorded as { speak?: string }).speak || "Got it, thank you."),
    workflow_state: session.currentState,
    data: { field_id: fieldId, missing_fields: session.missingFieldIds },
    ...timer.finish(true),
  };
}

export async function domainCheckAvailability(input: {
  ctx: LiveKitCallContext;
  spoken: string;
}): Promise<DomainActionResult> {
  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "check_availability");
  const timer = startDomainActionTimer("check_availability", input.ctx.callId, taskId);
  timer.markProviderStart();

  const result = await executeContinueWorkflow({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    callId: input.ctx.callId,
    userInput: input.spoken,
    workflow: "book_appointment",
    serviceName: input.ctx.session.serviceName,
    sessionContext: input.ctx.session,
  });
  timer.markProviderEnd();

  const refreshed = await getOrCreateRealtimeSession({
    callId: input.ctx.callId,
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
  });
  input.ctx.session = refreshed;
  input.ctx.workflowState = refreshed.currentState;

  return {
    ok: result.ok !== false,
    speak: String(result.speak || "Let me know what time works."),
    workflow_state: String(result.workflow_state || refreshed.currentState),
    data: (result.data as Record<string, unknown>) || {},
    error_code: result.error_code ? String(result.error_code) : undefined,
    ...timer.finish(result.ok !== false),
  };
}

export async function domainSelectSlot(input: {
  ctx: LiveKitCallContext;
  utterance: string;
  slotIso?: string;
}): Promise<DomainActionResult> {
  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "select_slot");
  const timer = startDomainActionTimer("select_slot", input.ctx.callId, taskId);
  timer.markProviderStart();

  const result = await executeContinueWorkflow({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    callId: input.ctx.callId,
    userInput: input.utterance,
    startsAt: input.slotIso,
    workflow: "book_appointment",
    serviceName: input.ctx.session.serviceName,
    sessionContext: input.ctx.session,
  });
  timer.markProviderEnd();

  const refreshed = await getOrCreateRealtimeSession({
    callId: input.ctx.callId,
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
  });
  input.ctx.session = refreshed;
  input.ctx.workflowState = refreshed.currentState;

  return {
    ok: result.ok !== false,
    speak: String(result.speak || "Which time would you prefer?"),
    workflow_state: String(result.workflow_state || refreshed.currentState),
    data: (result.data as Record<string, unknown>) || {},
    error_code: result.error_code ? String(result.error_code) : undefined,
    ...timer.finish(result.ok !== false),
  };
}

export async function domainConfirmBooking(input: {
  ctx: LiveKitCallContext;
  confirmed: boolean;
}): Promise<DomainActionResult> {
  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "confirm_booking");
  const timer = startDomainActionTimer("confirm_booking", input.ctx.callId, taskId);
  timer.markProviderStart();

  const result = await executeContinueWorkflow({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    callId: input.ctx.callId,
    userInput: input.confirmed ? "yes" : "no",
    confirm: input.confirmed,
    workflow: "book_appointment",
    serviceName: input.ctx.session.serviceName,
    sessionContext: input.ctx.session,
  });
  timer.markProviderEnd();

  const refreshed = await getOrCreateRealtimeSession({
    callId: input.ctx.callId,
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
  });
  input.ctx.session = refreshed;
  input.ctx.workflowState = refreshed.currentState;

  return {
    ok: result.ok !== false,
    speak: String(result.speak || "Should I go ahead and book that?"),
    workflow_state: String(result.workflow_state || refreshed.currentState),
    data: (result.data as Record<string, unknown>) || {},
    error_code: result.error_code ? String(result.error_code) : undefined,
    ...timer.finish(result.ok !== false),
  };
}
