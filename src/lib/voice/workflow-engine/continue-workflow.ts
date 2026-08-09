/**
 * Runtime-owned booking orchestration — single model-facing entry point.
 * Scheduling primitives (calendar, book, hold) execute internally only.
 */

import { getPrisma } from "@/lib/db";
import { resolveSpokenDatetime } from "@/lib/voice/calendar/resolve-datetime";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import { buildRuntimeContext, computeWorkflowState, refreshRuntimeAfterTool } from "./engine";
import { matchSlotFromInput } from "./slot-matching";

function normalizeSlotIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const str = String(value ?? "").trim();
  if (!str) return "";
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? str : d.toISOString();
}
import { deriveNextAction } from "./next-action";
import { loadAgentRuntime, saveAgentRuntime } from "./runtime-state";
import type { WorkflowState } from "./types";
import type { AmyRealtimeSession } from "@/lib/voice/realtime-session/types";
import { computeWorkflowStateFromSession } from "@/lib/voice/realtime-session/init";

export type ContinueWorkflowInput = {
  workspaceId: string;
  agentId?: string;
  callId: string;
  userInput?: string | null;
  confirm?: boolean;
  serviceName?: string | null;
  startsAt?: string | null;
  workflow?: WorkflowAction;
  /** Cached realtime session — skips redundant DB state reconstruction */
  sessionContext?: AmyRealtimeSession;
};

function normalizeResponse(input: {
  success: boolean;
  workflowState: WorkflowState;
  nextAction: string;
  speak: string;
  data?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
}): Record<string, unknown> {
  return {
    ok: input.success,
    success: input.success,
    workflow_state: input.workflowState,
    next_action: input.nextAction,
    speak: input.speak,
    message: input.speak,
    data: input.data || {},
    ...(input.error ? { error: input.error } : {}),
    ...(input.errorCode ? { error_code: input.errorCode } : {}),
  };
}

async function businessTimezone(workspaceId: string): Promise<string> {
  try {
    const prisma = getPrisma();
    const messaging = await prisma.workspaceMessagingSettings.findUnique({
      where: { workspaceId },
      select: { timezone: true },
    });
    return String(messaging?.timezone || "America/New_York");
  } catch {
    return "America/New_York";
  }
}

function formatSlotLabel(iso: string, timezone = "America/New_York"): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatSlotsForSpeech(slots: Array<{ startsAt?: string; start_time?: string }>): string {
  const labels = slots
    .slice(0, 5)
    .map((s) => {
      const iso = String(s.startsAt || s.start_time || "");
      if (!iso) return "";
      try {
        const d = new Date(iso);
        return d.toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      } catch {
        return iso;
      }
    })
    .filter(Boolean);
  if (!labels.length) return "I don't see any openings in that window.";
  if (labels.length === 1) return `I have ${labels[0]} available.`;
  const last = labels.pop();
  return `I have ${labels.join(", ")}, and ${last} available.`;
}

const FLEXIBLE_AVAILABILITY_RE =
  /\b(next\s+available|any\s+time|don'?t\s+care|soonest|first\s+open|whatever\s+works|asap|earliest|next\s+day\s+you\s+have)\b/i;

function defaultAvailabilityDaysAhead(spoken: string): number {
  if (FLEXIBLE_AVAILABILITY_RE.test(spoken)) return 7;
  return 7;
}

function callerFacingNoSlotsMessage(spoken: string): string {
  if (FLEXIBLE_AVAILABILITY_RE.test(spoken)) {
    return "I'm not seeing any openings in the next week. Would you like me to check further out, or take a message for a callback?";
  }
  return "I don't see anything open for that day. Would another day or time work?";
}

async function internalAvailability(input: {
  workspaceId: string;
  agentId?: string;
  callId: string;
  serviceName: string;
  spoken: string;
  timezone: string;
}) {
  const resolved = resolveSpokenDatetime({
    spoken: input.spoken,
    timezone: input.timezone,
  });
  const resolvedIso =
    resolved.ok && resolved.resolvedIso ? resolved.resolvedIso : null;

  const raw: Record<string, unknown> = {
    serviceName: input.serviceName,
    timezone: input.timezone,
  };
  if (resolvedIso) {
    raw.resolvedIso = resolvedIso;
    raw.from = resolvedIso;
    raw.to = resolvedIso;
  } else {
    raw.daysAhead = defaultAvailabilityDaysAhead(input.spoken);
  }

  return executeAgentTool({
    toolType: "calendar_availability",
    context: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
    },
    raw,
  });
}

async function internalBook(input: {
  workspaceId: string;
  agentId?: string;
  callId: string;
  serviceName: string;
  startsAt: string;
  timezone: string;
}) {
  return executeAgentTool({
    toolType: "book_appointment",
    context: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
    },
    raw: {
      serviceName: input.serviceName,
      startsAt: input.startsAt,
      startAt: input.startsAt,
      timezone: input.timezone,
      operation_id: `${input.callId}-book-${input.startsAt}`,
    },
  });
}

async function internalHold(input: {
  workspaceId: string;
  agentId?: string;
  callId: string;
  serviceName: string;
  startsAt: string;
}) {
  return executeAgentTool({
    toolType: "hold_appointment_slot",
    context: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
    },
    raw: {
      serviceName: input.serviceName,
      startsAt: input.startsAt,
      operation_id: `${input.callId}-hold-${input.startsAt}`,
    },
  });
}

export async function executeContinueWorkflow(
  input: ContinueWorkflowInput,
): Promise<Record<string, unknown>> {
  const workflow = input.workflow || "book_appointment";
  const timezone = input.sessionContext?.timezone ?? (await businessTimezone(input.workspaceId));
  const userInput = String(input.userInput || input.startsAt || "").trim();

  let state: WorkflowState;
  let runtime: Awaited<ReturnType<typeof loadAgentRuntime>>;

  if (input.sessionContext) {
    state = computeWorkflowStateFromSession(input.sessionContext);
    runtime = input.sessionContext.runtime;
  } else {
    const computed = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName: input.serviceName,
    });
    state = computed.state;
    runtime = computed.runtime;
  }

  const serviceName =
    input.serviceName ||
    runtime.service_name ||
    null;

  const resolvedServiceName = serviceName || "Service Visit";

  if (state === "INTENT_DISCOVERY" || state === "COLLECTING_FIELDS") {
    const ctx = await buildRuntimeContext({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName: resolvedServiceName,
    });
    return normalizeResponse({
      success: true,
      workflowState: state,
      nextAction: "COLLECT_CURRENT_FIELD",
      speak:
        ctx.current_field?.collection_instruction ||
        ctx.speak ||
        "I still need a few details before we check availability.",
      data: {
        current_field: ctx.current_field,
        missing_fields: ctx.missing_fields,
        workflow_complete: ctx.workflow_complete,
      },
    });
  }

  if (state === "CHECKING_AVAILABILITY") {
    if (!userInput) {
      return normalizeResponse({
        success: true,
        workflowState: state,
        nextAction: "ASK_CALLER_FOR_PREFERRED_TIME",
        speak: "What day or time works best for you?",
        data: { workflow_complete: true },
      });
    }

    const availResult = await internalAvailability({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      serviceName: resolvedServiceName,
      spoken: userInput,
      timezone,
    });

    await refreshRuntimeAfterTool({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      toolType: "calendar_availability",
      toolResult: availResult,
      workflow,
      serviceName: resolvedServiceName,
    });

    const { state: nextState } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName: resolvedServiceName,
    });

    const slots = Array.isArray(availResult.slots)
      ? (availResult.slots as Array<{ startsAt?: string; start_time?: string }>)
      : [];

    return normalizeResponse({
      success: availResult.ok !== false,
      workflowState: nextState,
      nextAction: slots.length ? "ASK_CALLER_TO_SELECT_SLOT" : "ASK_CALLER_FOR_DIFFERENT_TIME",
      speak: slots.length
        ? formatSlotsForSpeech(slots)
        : callerFacingNoSlotsMessage(userInput),
      data: { slots, service_name: resolvedServiceName },
    });
  }

  if (state === "SELECTING_SLOT") {
    const rawSlots =
      input.sessionContext?.availableSlots?.length
        ? input.sessionContext.availableSlots
        : runtime.proposed_slots?.length > 0
          ? runtime.proposed_slots
          : await (async () => {
            const prisma = getPrisma();
            const call = await prisma.voiceCall.findFirst({
              where: { id: input.callId, workspaceId: input.workspaceId },
              select: { metadata: true },
            });
            const meta = (call?.metadata || {}) as Record<string, unknown>;
            return Array.isArray(meta.lastAvailabilitySlots)
              ? (meta.lastAvailabilitySlots as string[])
              : [];
          })();
    const slots = rawSlots.map(normalizeSlotIso).filter(Boolean);

    const startsAtNorm = input.startsAt ? normalizeSlotIso(input.startsAt) : null;
    const picked =
      (startsAtNorm && slots.includes(startsAtNorm) ? startsAtNorm : null) ||
      (userInput ? matchSlotFromInput(userInput, slots, timezone) : null);

    if (!picked) {
      return normalizeResponse({
        success: false,
        workflowState: state,
        nextAction: "ASK_CALLER_TO_SELECT_SLOT",
        speak: slots.length
          ? `Please choose one of the available times: ${formatSlotsForSpeech(slots.map((s) => ({ startsAt: s })))}`
          : "I need you to pick a time from the slots I offered.",
        errorCode: "SLOT_NOT_RECOGNIZED",
        data: { slots: slots.map((s) => ({ startsAt: s })) },
      });
    }

    const holdResult = await internalHold({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      serviceName: resolvedServiceName,
      startsAt: picked,
    });

    await refreshRuntimeAfterTool({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      toolType: "hold_appointment_slot",
      toolResult: holdResult,
      workflow,
      serviceName: resolvedServiceName,
    });

    let updated = await loadAgentRuntime(input.callId);
    if (updated) {
      updated = {
        ...updated,
        selected_slot: picked,
        held_slot: picked,
        updated_at: new Date().toISOString(),
      };
      await saveAgentRuntime(input.callId, updated);
    }

    const { state: nextState } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName: resolvedServiceName,
    });

    return normalizeResponse({
      success: holdResult.ok !== false,
      workflowState: nextState,
      nextAction: "ASK_CALLER_TO_CONFIRM_BOOKING",
      speak:
        "Got it. Let me confirm — would you like me to book that appointment?",
      data: {
        selected_slot: picked,
        startsAt: picked,
        hold: holdResult,
      },
    });
  }

  if (state === "READY_TO_BOOK" || state === "BOOKING_IN_PROGRESS") {
    if (!input.confirm) {
      const slot = normalizeSlotIso(runtime.selected_slot || runtime.held_slot || "");
      const slotLabel = slot ? formatSlotLabel(slot, timezone) : "";
      return normalizeResponse({
        success: true,
        workflowState: state,
        nextAction: "ASK_CALLER_TO_CONFIRM_BOOKING",
        speak: slotLabel
          ? `I have ${slotLabel} held for you. Should I go ahead and book that appointment?`
          : "Please confirm you'd like me to book this appointment.",
        data: { selected_slot: slot || null, requires_confirm: true },
      });
    }

    const startsAt = normalizeSlotIso(runtime.selected_slot || runtime.held_slot || "");
    if (!startsAt) {
      return normalizeResponse({
        success: false,
        workflowState: state,
        nextAction: "ASK_CALLER_TO_SELECT_SLOT",
        speak: "I don't have a time selected yet. Which slot would you like?",
        errorCode: "NO_SELECTED_SLOT",
      });
    }

    const bookResult = await internalBook({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      callId: input.callId,
      serviceName: resolvedServiceName,
      startsAt,
      timezone,
    });

    await refreshRuntimeAfterTool({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      toolType: "book_appointment",
      toolResult: bookResult,
      workflow,
      serviceName: resolvedServiceName,
    });

    const { state: nextState } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName: resolvedServiceName,
    });

    const booked = bookResult.ok !== false && bookResult.status === "confirmed";
    const errorCode =
      bookResult.error_code != null ? String(bookResult.error_code) : undefined;
    const missingField = errorCode === "MISSING_REQUIRED_FIELD";
    return normalizeResponse({
      success: booked,
      workflowState: missingField ? "COLLECTING_FIELDS" : nextState,
      nextAction: booked
        ? "BOOKING_COMPLETE"
        : missingField
          ? "COLLECT_CURRENT_FIELD"
          : "RETRY_OR_OFFER_ALTERNATIVES",
      speak:
        typeof bookResult.speak === "string" && bookResult.speak
          ? bookResult.speak
          : booked
            ? "You're all set — your appointment is confirmed."
            : "I wasn't able to complete the booking. Would you like to try another time?",
      errorCode,
      data: {
        appointment_id: bookResult.appointment_id || bookResult.appointmentId,
        startsAt,
        booking: bookResult,
        needsFieldCollection: missingField,
      },
    });
  }

  if (state === "COMPLETE") {
    return normalizeResponse({
      success: true,
      workflowState: state,
      nextAction: "NONE",
      speak: "Your appointment is already confirmed. Is there anything else I can help with?",
      data: { booking_id: runtime.booking_id },
    });
  }

  const ctx = await buildRuntimeContext({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: resolvedServiceName,
  });

  return normalizeResponse({
    success: true,
    workflowState: state,
    nextAction: deriveNextAction({
      state,
      complete: ctx.workflow_complete,
      currentField: ctx.current_field,
      missingFields: ctx.missing_fields,
    }) || "GET_RUNTIME_CONTEXT",
    speak: ctx.speak || "How can I help you with your appointment?",
    data: { workflow_complete: ctx.workflow_complete },
  });
}
