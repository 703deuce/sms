/**
 * Runtime-owned booking orchestration — single model-facing entry point.
 * Scheduling primitives (calendar, book, hold) execute internally only.
 */

import { getPrisma } from "@/lib/db";
import { resolveSpokenDatetime } from "@/lib/voice/calendar/resolve-datetime";
import { executeAgentTool } from "@/lib/voice/agent-tool-gateway/gateway";
import type { WorkflowAction } from "@/lib/voice/field-runtime/types";
import { buildRuntimeContext, computeWorkflowState, refreshRuntimeAfterTool } from "./engine";

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

export type ContinueWorkflowInput = {
  workspaceId: string;
  agentId?: string;
  callId: string;
  userInput?: string | null;
  confirm?: boolean;
  serviceName?: string | null;
  startsAt?: string | null;
  workflow?: WorkflowAction;
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

function matchSlotFromInput(
  userInput: string,
  slots: string[],
): string | null {
  const trimmed = userInput.trim();
  if (!trimmed) return null;

  // Exact ISO match
  const exact = slots.find((s) => s === trimmed || trimmed.includes(s));
  if (exact) return exact;

  const lower = trimmed.toLowerCase();
  for (const slot of slots) {
    const d = new Date(slot);
    if (Number.isNaN(d.getTime())) continue;
    const hour12 = d.getUTCHours() % 12 || 12;
    const ampm = d.getUTCHours() >= 12 ? "pm" : "am";
    const patterns = [
      `${hour12}`,
      `${hour12}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
      `${hour12}${ampm}`,
      `${hour12} ${ampm}`,
    ];
    if (patterns.some((p) => lower.includes(p))) return slot;
  }
  return null;
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
    raw.daysAhead = 1;
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
  const timezone = await businessTimezone(input.workspaceId);
  const userInput = String(input.userInput || input.startsAt || "").trim();

  const { state, runtime } = await computeWorkflowState({
    callId: input.callId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    workflow,
    serviceName: input.serviceName,
  });

  const serviceName =
    input.serviceName ||
    runtime.service_name ||
    "Appointment";

  if (state === "INTENT_DISCOVERY" || state === "COLLECTING_FIELDS") {
    const ctx = await buildRuntimeContext({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName,
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
      serviceName,
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
      serviceName,
    });

    const { state: nextState } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName,
    });

    const slots = Array.isArray(availResult.slots)
      ? (availResult.slots as Array<{ startsAt?: string; start_time?: string }>)
      : [];

    return normalizeResponse({
      success: availResult.ok !== false,
      workflowState: nextState,
      nextAction: slots.length ? "ASK_CALLER_TO_SELECT_SLOT" : "ASK_CALLER_FOR_DIFFERENT_TIME",
      speak:
        typeof availResult.speak === "string" && availResult.speak
          ? availResult.speak
          : formatSlotsForSpeech(slots),
      data: { slots, service_name: serviceName },
    });
  }

  if (state === "SELECTING_SLOT") {
    const rawSlots =
      runtime.proposed_slots?.length > 0
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
      (userInput ? matchSlotFromInput(userInput, slots) : null);

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
      serviceName,
      startsAt: picked,
    });

    await refreshRuntimeAfterTool({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      toolType: "hold_appointment_slot",
      toolResult: holdResult,
      workflow,
      serviceName,
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
      serviceName,
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
      const slot = runtime.selected_slot || runtime.held_slot;
      return normalizeResponse({
        success: true,
        workflowState: state,
        nextAction: "ASK_CALLER_TO_CONFIRM_BOOKING",
        speak: slot
          ? "Should I go ahead and book that appointment for you?"
          : "Please confirm you'd like me to book this appointment.",
        data: { selected_slot: slot, requires_confirm: true },
      });
    }

    const startsAt = runtime.selected_slot || runtime.held_slot;
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
      serviceName,
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
      serviceName,
    });

    const { state: nextState } = await computeWorkflowState({
      callId: input.callId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      workflow,
      serviceName,
    });

    const booked = bookResult.ok !== false && bookResult.status === "confirmed";
    return normalizeResponse({
      success: bookResult.ok !== false,
      workflowState: nextState,
      nextAction: booked ? "BOOKING_COMPLETE" : "RETRY_OR_OFFER_ALTERNATIVES",
      speak:
        typeof bookResult.speak === "string" && bookResult.speak
          ? bookResult.speak
          : booked
            ? "You're all set — your appointment is confirmed."
            : "I wasn't able to complete the booking. Would you like to try another time?",
      data: {
        appointment_id: bookResult.appointment_id || bookResult.appointmentId,
        startsAt,
        booking: bookResult,
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
    serviceName,
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
