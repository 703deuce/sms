/**
 * Legacy Caller Amy workflow state machine.
 * LEGACY / TEST ONLY — production Realtor/frontdesk use LiveKit AgentSession + domain state.
 */
import { getPrisma } from "@/lib/db";
import { getWorkflowRequirements } from "@/lib/voice/field-runtime/requirements";
import { ensureWorkflowFieldSession, allSessionFieldsFlat } from "@/lib/voice/field-runtime/session";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import {
  ensureAgentRuntime,
  loadAgentRuntime,
  saveAgentRuntime,
  transitionState,
} from "./runtime-state";
import { deriveNextAction, schedulingDoNotAdvanceHint } from "./next-action";
import { toolsForState } from "./states";
import type { AgentRuntimeRecord, RuntimeContextPayload, WorkflowState } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeSlotIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const str = String(value ?? "").trim();
  if (!str) return "";
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : d.toISOString();
}

/** Derive workflow state from persisted call + field session data. */
export async function computeWorkflowState(input: {
  callId: string;
  workspaceId: string;
  agentId?: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<{ state: WorkflowState; runtime: AgentRuntimeRecord }> {
  const workflow = input.workflow || "book_appointment";
  let runtime = await ensureAgentRuntime({
    callId: input.callId,
    workflowId: workflow,
    serviceName: input.serviceName,
  });

  const prisma = getPrisma();
  const call = await prisma.voiceCall.findFirst({
    where: { id: input.callId, workspaceId: input.workspaceId },
    select: {
      appointmentBooked: true,
      metadata: true,
    },
  });
  if (!call) {
    throw new Error("Call not found for workspace");
  }
  const meta = asRecord(call?.metadata);
  const metaSlots = Array.isArray(meta.lastAvailabilitySlots)
    ? (meta.lastAvailabilitySlots as unknown[]).map(normalizeSlotIso).filter(Boolean)
    : [];
  const lastSlots =
    metaSlots.length > 0
      ? metaSlots
      : Array.isArray(runtime.proposed_slots)
        ? runtime.proposed_slots.map(normalizeSlotIso).filter(Boolean)
        : [];

  if (runtime.pending_operations.length > 0) {
    const next = transitionState(runtime, "BOOKING_IN_PROGRESS", "pending_operation");
    if (next.state !== runtime.state) {
      runtime = next;
      await saveAgentRuntime(input.callId, runtime);
    }
    return { state: "BOOKING_IN_PROGRESS", runtime };
  }

  if (call?.appointmentBooked || runtime.booking_id) {
    const next = transitionState(runtime, "COMPLETE", "appointment_confirmed");
    if (next.state !== runtime.state) {
      runtime = next;
      await saveAgentRuntime(input.callId, runtime);
    }
    return { state: "COMPLETE", runtime };
  }

  if (workflow === "general" || workflow === "leave_message" || workflow === "request_quote") {
    const next = transitionState(runtime, "GENERAL", `workflow_${workflow}`);
    if (next.state !== runtime.state) {
      runtime = next;
      await saveAgentRuntime(input.callId, runtime);
    }
    return { state: "GENERAL", runtime };
  }

  const requirements = await getWorkflowRequirements({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    workflow,
    serviceName: input.serviceName,
  });

  let state: WorkflowState;

  if (!requirements.complete) {
    state = runtime.intent ? "COLLECTING_FIELDS" : "INTENT_DISCOVERY";
  } else if (!lastSlots.length) {
    state = "CHECKING_AVAILABILITY";
  } else if (!runtime.selected_slot && !runtime.held_slot) {
    state = "SELECTING_SLOT";
    runtime = {
      ...runtime,
      proposed_slots: lastSlots,
      updated_at: new Date().toISOString(),
    };
  } else {
    if (runtime.held_slot && !runtime.selected_slot) {
      runtime = { ...runtime, selected_slot: runtime.held_slot };
    }
    state = "READY_TO_BOOK";
  }

  const next = transitionState(runtime, state, "state_recompute");
  if (next.state !== runtime.state || next.proposed_slots !== runtime.proposed_slots) {
    await saveAgentRuntime(input.callId, next);
  }
  return { state, runtime: next };
}

export async function refreshRuntimeAfterTool(input: {
  callId: string;
  workspaceId: string;
  agentId?: string;
  toolType: string;
  toolResult?: Record<string, unknown>;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<AgentRuntimeRecord> {
  const workflow = input.workflow || "book_appointment";
  let runtime = await loadAgentRuntime(input.callId);
  if (!runtime) {
    runtime = await ensureAgentRuntime({
      callId: input.callId,
      workflowId: workflow,
      serviceName: input.serviceName,
    });
  }

  const result = input.toolResult || {};

  if (
    input.toolType === "get_workflow_requirements" ||
    input.toolType === "record_current_field" ||
    input.toolType === "save_collected_fields" ||
    input.toolType === "continue_workflow"
  ) {
    runtime = { ...runtime, intent: workflow };
  }

  if (input.toolType === "calendar_availability" || input.toolType === "check_availability") {
    const slots = Array.isArray(result.slots)
      ? (result.slots as Array<{ startsAt?: unknown }>)
          .map((s) => normalizeSlotIso(s.startsAt))
          .filter(Boolean)
      : Array.isArray(result.lastAvailabilitySlots)
        ? (result.lastAvailabilitySlots as unknown[]).map(normalizeSlotIso).filter(Boolean)
        : [];
    if (slots.length) {
      runtime = { ...runtime, proposed_slots: slots };
    }
  }

  if (input.toolType === "hold_appointment_slot" && result.startsAt) {
    const slot = String(result.startsAt);
    runtime = { ...runtime, held_slot: slot, selected_slot: slot };
  }

  if (input.toolType === "release_appointment_hold") {
    runtime = { ...runtime, held_slot: null };
  }

  if (input.toolType === "book_appointment") {
    const operationId = result.operation_id ? String(result.operation_id) : null;
    const startsAt = result.start_time || result.startsAt;
    if (startsAt) {
      runtime = { ...runtime, selected_slot: String(startsAt) };
    }
    if (operationId && !runtime.pending_operations.includes(operationId)) {
      runtime = {
        ...runtime,
        pending_operations: [...runtime.pending_operations, operationId],
      };
    }
    if (result.success !== false && result.status === "confirmed") {
      runtime = {
        ...runtime,
        booking_id: result.appointment_id ? String(result.appointment_id) : runtime.booking_id,
        selected_slot: result.start_time ? String(result.start_time) : runtime.selected_slot,
        pending_operations: runtime.pending_operations.filter((id) => id !== operationId),
      };
    } else if (result.success !== false && result.status === "already_completed") {
      runtime = {
        ...runtime,
        booking_id: result.appointment_id ? String(result.appointment_id) : runtime.booking_id,
        pending_operations: runtime.pending_operations.filter((id) => id !== operationId),
      };
    } else if (result.success === false && operationId) {
      runtime = {
        ...runtime,
        pending_operations: runtime.pending_operations.filter((id) => id !== operationId),
      };
    }
  }

  await saveAgentRuntime(input.callId, runtime);
  await computeWorkflowState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const refreshed = await loadAgentRuntime(input.callId);
  return refreshed || runtime;
}

export async function buildRuntimeContext(input: {
  callId: string;
  workspaceId: string;
  agentId?: string;
  workflow?: WorkflowAction;
  serviceName?: string | null;
}): Promise<RuntimeContextPayload> {
  const workflow = input.workflow || "book_appointment";
  const { state, runtime } = await computeWorkflowState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const requirements = await getWorkflowRequirements({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    callId: input.callId,
    workflow,
    serviceName: input.serviceName,
  });

  const session = await ensureWorkflowFieldSession({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const known = allSessionFieldsFlat(session);
  const activeFieldId = requirements.active_field;
  const currentField =
    requirements.fields_to_collect.find((f) => f.field_id === activeFieldId) ||
    requirements.missing_fields[0] ||
    null;

  return {
    workflow_id: workflow,
    workflow_version: runtime.workflow_version,
    state,
    intent: runtime.intent || null,
    service_name: input.serviceName || runtime.service_name || null,
    allowed_tools: toolsForState(state),
    current_field: currentField,
    missing_fields: requirements.missing_fields,
    fields_to_collect: requirements.fields_to_collect,
    complete: requirements.complete,
    workflow_complete: requirements.complete,
    known_fields: known,
    selected_slot: runtime.selected_slot ?? null,
    held_slot: runtime.held_slot ?? null,
    booking_id: runtime.booking_id ?? null,
    pending_operations: runtime.pending_operations,
    speak: requirements.speak,
    next_action: deriveNextAction({
      state,
      complete: requirements.complete,
      currentField,
      missingFields: requirements.missing_fields,
    }),
    do_not_advance: schedulingDoNotAdvanceHint(state),
  };
}
