import { recordFieldForLiveKitVoice } from "@/lib/voice/field-runtime/save-voice-fast";
import { executeContinueWorkflow } from "@/lib/voice/workflow-engine/continue-workflow";
import {
  authorizeCapabilityInvocation,
} from "@/lib/voice/workflow-runtime/capability-guard";
import { resolveActiveWorkflowForAgent } from "@/lib/voice/workflow-runtime/loader";
import { buildRuntimeSnapshotFromSession } from "@/lib/voice/workflow-runtime/compile-turn-envelope";
import { startDomainActionTimer } from "./latency";
import { assertTaskToolAllowed, taskForWorkflowState } from "./task-guard";
import {
  bookingFailureNeedsFieldCollection,
  reconcileSessionAfterBookingFieldGap,
  resolveRecordFieldId,
} from "./late-booking-fields";
import {
  buildHeldSlotPayload,
  buildRecordFieldPayload,
  buildRequirementsPayload,
} from "./tool-results";
import {
  reloadLiveKitSchedulingSession,
  slotsForToolResult,
  traceLiveKitDomainAction,
} from "./scheduling-session";

export type DomainActionResult = {
  ok: boolean;
  speak: string;
  workflow_state?: string;
  data?: Record<string, unknown>;
  error_code?: string;
};

function guardToolInvocation(
  ctx: LiveKitCallContext,
  toolName: string,
): DomainActionResult | null {
  const { definition: workflow, ref } = resolveActiveWorkflowForAgent(ctx.agentId);
  const snapshot = buildRuntimeSnapshotFromSession({
    workflow,
    workflowVersion: ref.version,
    legacyState: ctx.session.currentState,
    currentNodeId:
      ctx.session.currentNodeId ||
      ctx.session.runtime.current_node_id ||
      null,
    collectedFields: ctx.session.collectedFields || {},
    confirmationReceived:
      ctx.session.confirmationState === "confirmed" ||
      Boolean(ctx.session.runtime.confirmation_received),
    flags: {
      ...(ctx.workflowRuntime?.flags || {}),
      _envelopeCapabilities: ctx.lastToolEnvelope?.capabilityIds,
    },
  });
  const guard = authorizeCapabilityInvocation({ workflow, state: snapshot, toolName });
  if (guard.ok) return null;
  return {
    ok: false,
    speak: guard.speak,
    error_code: guard.error_code,
    workflow_state: ctx.session.currentState,
  };
}

export async function domainGetBookingRequirements(input: {
  ctx: LiveKitCallContext;
}): Promise<DomainActionResult> {
  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "get_booking_requirements");
  const timer = startDomainActionTimer("get_booking_requirements", input.ctx.callId, taskId);

  const payload = buildRequirementsPayload(input.ctx.session);
  const readyForAvailability = Boolean(payload.readyForAvailability);
  const workflowState = readyForAvailability
    ? "CHECKING_AVAILABILITY"
    : input.ctx.session.currentState;

  if (readyForAvailability) {
    input.ctx.session = {
      ...input.ctx.session,
      currentState: "CHECKING_AVAILABILITY",
    };
    input.ctx.workflowState = "CHECKING_AVAILABILITY";
  }

  timer.finish(true);
  return {
    ok: true,
    speak: readyForAvailability
      ? "All required information is collected."
      : String(
          (payload.activeField as { instruction?: string } | null)?.instruction ||
            "I need a few details to get started.",
        ),
    workflow_state: workflowState,
    data: payload,
  };
}

export async function domainRecordField(input: {
  ctx: LiveKitCallContext;
  value: string;
  fieldId?: string;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "record_current_field");
  if (blocked) return blocked;

  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "record_current_field");
  const timer = startDomainActionTimer("record_current_field", input.ctx.callId, taskId);

  const fieldId = resolveRecordFieldId({
    session: input.ctx.session,
    value: input.value,
    fieldId: input.fieldId,
  });
  if (!fieldId) {
    timer.finish(false, "NO_ACTIVE_FIELD");
    return {
      ok: false,
      speak: "I still need some information from you.",
      error_code: "NO_ACTIVE_FIELD",
      data: buildRequirementsPayload(input.ctx.session),
    };
  }

  const recorded = await recordFieldForLiveKitVoice({
    amySession: input.ctx.session,
    value: input.value,
    fieldId,
  });
  timer.markProviderEnd();

  if (!recorded.ok) {
    timer.finish(false, recorded.error_code);
    return {
      ok: false,
      speak: recorded.speak,
      error_code: recorded.error_code,
      data: buildRequirementsPayload(recorded.amySession),
    };
  }

  input.ctx.session = recorded.amySession;
  input.ctx.workflowState = recorded.workflowState;

  const fieldPayload = buildRecordFieldPayload({
    session: recorded.amySession,
    recordedFieldId: fieldId,
  });

  await traceLiveKitDomainAction(input.ctx, "record_current_field", {
    ok: true,
    speak: recorded.speak,
    workflow_state: recorded.workflowState,
    data: fieldPayload,
  });

  timer.finish(true, undefined, { phases: { voiceFieldTiming: recorded.timing } });
  return {
    ok: true,
    speak: recorded.speak,
    workflow_state: recorded.workflowState,
    data: {
      ...fieldPayload,
      voice_field_timing: recorded.timing,
      readyForAvailability: recorded.amySession.missingFieldIds.length === 0,
    },
  };
}

export async function domainCheckAvailability(input: {
  ctx: LiveKitCallContext;
  spoken: string;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "check_availability");
  if (blocked) return blocked;

  if (input.ctx.session.missingFieldIds.length > 0) {
    const payload = buildRequirementsPayload(input.ctx.session);
    return {
      ok: false,
      speak: String(
        (payload.activeField as { instruction?: string } | null)?.instruction ||
          "I still need a few details before I can check the calendar.",
      ),
      error_code: "MISSING_REQUIRED_DATA",
      workflow_state: "COLLECTING_FIELDS",
      data: {
        ...payload,
        nextAction: "record_current_field",
      },
    };
  }

  const taskId = taskForWorkflowState(input.ctx.session.currentState);
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

  const refreshed = await reloadLiveKitSchedulingSession(input.ctx, result);
  const ok = result.ok !== false;
  const slots = slotsForToolResult(refreshed, result);
  timer.finish(ok, result.error_code ? String(result.error_code) : undefined, {
    phases: {
      slotCount: slots.length,
    },
  });
  const response: DomainActionResult = {
    ok,
    speak: String(
      result.speak ||
        (slots.length
          ? "Here are the times I found."
          : "I couldn't find openings for that window."),
    ),
    workflow_state: String(result.workflow_state || refreshed.currentState),
    data: {
      timezone: refreshed.timezone,
      slots,
      nextAction: slots.length ? "select_slot" : "ask_for_another_date_or_range",
      ...(typeof result.data === "object" && result.data ? (result.data as Record<string, unknown>) : {}),
    },
    error_code: result.error_code
      ? String(result.error_code)
      : ok
        ? undefined
        : "CALENDAR_UNAVAILABLE",
  };
  await traceLiveKitDomainAction(input.ctx, "check_availability", response);
  return response;
}

export async function domainSelectSlot(input: {
  ctx: LiveKitCallContext;
  utterance: string;
  slotIso?: string;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "select_slot");
  if (blocked) return blocked;

  const taskId = taskForWorkflowState(input.ctx.session.currentState);
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

  const refreshed = await reloadLiveKitSchedulingSession(input.ctx, result);
  const ok = result.ok !== false;
  const heldSlot = buildHeldSlotPayload(refreshed);
  const ambiguous =
    !ok &&
    (result.error_code === "AMBIGUOUS_SELECTION" ||
      String(result.speak || "").toLowerCase().includes("which"));
  timer.finish(ok, result.error_code ? String(result.error_code) : undefined);
  const response: DomainActionResult = {
    ok,
    speak: String(result.speak || "Which time would you prefer?"),
    workflow_state: String(result.workflow_state || refreshed.currentState),
    data: {
      heldSlot,
      nextAction: ok ? "confirm_booking" : ambiguous ? "clarify_slot" : "select_slot",
      matchingSlots: ambiguous ? slotsForToolResult(refreshed, result) : undefined,
      reason: ambiguous ? "AMBIGUOUS_SELECTION" : undefined,
      ...(typeof result.data === "object" && result.data ? (result.data as Record<string, unknown>) : {}),
    },
    error_code: result.error_code ? String(result.error_code) : undefined,
  };
  await traceLiveKitDomainAction(input.ctx, "select_slot", response);
  return response;
}

export async function domainConfirmBooking(input: {
  ctx: LiveKitCallContext;
  confirmed: boolean;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "confirm_booking");
  if (blocked) return blocked;

  const taskId = taskForWorkflowState(input.ctx.session.currentState);
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

  const refreshed = await reloadLiveKitSchedulingSession(input.ctx, result);
  const ok = result.ok === true && input.confirmed;
  let session = refreshed;

  if (!ok && input.confirmed) {
    session = await reconcileSessionAfterBookingFieldGap({
      ctx: input.ctx,
      session: refreshed,
      result,
      confirmed: input.confirmed,
    });
  } else {
    input.ctx.session = refreshed;
  }

  const missingFieldError = bookingFailureNeedsFieldCollection({
    confirmed: input.confirmed,
    result,
    session,
  });

  const heldSlot = buildHeldSlotPayload(session);
  timer.finish(ok, result.error_code ? String(result.error_code) : undefined);
  const response: DomainActionResult = {
    ok,
    speak: String(
      result.speak ||
        (input.confirmed ? "Should I go ahead and book that?" : "No problem. What would you like instead?"),
    ),
    workflow_state: missingFieldError && !ok ? "COLLECTING_FIELDS" : String(result.workflow_state || session.currentState),
    data: {
      booking: ok
        ? {
            bookingId: session.bookingId,
            start: heldSlot?.start,
            spokenLabel: heldSlot?.spokenLabel,
          }
        : undefined,
      heldSlot,
      needsFieldCollection: missingFieldError && !ok,
      nextAction: ok
        ? "end_call"
        : missingFieldError
          ? "record_current_field"
          : result.error_code === "SLOT_NO_LONGER_AVAILABLE"
            ? "check_availability"
            : "confirm_booking",
      ...(typeof result.data === "object" && result.data ? (result.data as Record<string, unknown>) : {}),
    },
    error_code: result.error_code ? String(result.error_code) : undefined,
  };
  await traceLiveKitDomainAction(input.ctx, "confirm_booking", response);
  return response;
}

export async function domainRecordFields(input: {
  ctx: LiveKitCallContext;
  fields: Record<string, string>;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "record_fields");
  if (blocked) return blocked;

  let lastResult: DomainActionResult | null = null;
  for (const [fieldId, value] of Object.entries(input.fields)) {
    if (!value?.trim()) continue;
    lastResult = await domainRecordField({ ctx: input.ctx, value, fieldId });
    if (!lastResult.ok) return lastResult;
  }
  return (
    lastResult || {
      ok: false,
      speak: "I didn't receive any field values to record.",
      error_code: "NO_FIELDS",
      workflow_state: input.ctx.session.currentState,
    }
  );
}

export async function domainTakeMessage(input: {
  ctx: LiveKitCallContext;
  message: string;
  callerName?: string;
}): Promise<DomainActionResult> {
  const blocked = guardToolInvocation(input.ctx, "take_message");
  if (blocked) return blocked;

  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "take_message");
  const timer = startDomainActionTimer("take_message", input.ctx.callId, taskId);

  const collected = input.ctx.session.collectedFields || {};
  const callerName =
    input.callerName ||
    collected.caller_name ||
    collected.name ||
    collected.full_name ||
    "";
  const phone =
    collected.callback_number ||
    collected.phone ||
    input.ctx.session.callerAni ||
    "";

  const { executeBuiltinVoiceAction } = await import("@/lib/voice/tools/builtin-actions");
  const result = await executeBuiltinVoiceAction({
    workspaceId: input.ctx.workspaceId,
    agentId: input.ctx.agentId,
    callId: input.ctx.callId,
    toolType: "take_structured_message",
    input: {
      reason: input.message,
      caller_name: callerName,
      phone,
      urgency: "normal",
      notes: JSON.stringify(collected),
    },
  }).catch((err) => ({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));

  const ok = result && typeof result === "object" && (result as { ok?: boolean }).ok !== false;
  timer.finish(ok);

  const response: DomainActionResult = {
    ok,
    speak: ok
      ? "Thanks — I've noted that and someone from the team will follow up."
      : "I had trouble saving that message. Let me try again.",
    workflow_state: ok ? "COMPLETE" : input.ctx.session.currentState,
    data: {
      messageCaptured: ok,
      callerName: callerName || null,
      messageLength: input.message.length,
      persisted: ok,
    },
    error_code: ok ? undefined : "MESSAGE_SAVE_FAILED",
  };
  await traceLiveKitDomainAction(input.ctx, "take_message", response);
  return response;
}

export async function domainEndCall(input: {
  ctx: LiveKitCallContext;
  reason?: string;
}): Promise<DomainActionResult> {
  const taskId = taskForWorkflowState(input.ctx.session.currentState);
  assertTaskToolAllowed(taskId, "end_call");
  const timer = startDomainActionTimer("end_call", input.ctx.callId, taskId);
  timer.finish(true);
  return {
    ok: true,
    speak: "Thanks for calling. Have a great day!",
    workflow_state: "COMPLETE",
    data: {
      endCall: true,
      reason: input.reason || "workflow_complete",
    },
  };
}
