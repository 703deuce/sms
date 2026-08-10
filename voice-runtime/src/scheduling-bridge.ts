import { recordFieldForLiveKitVoice } from "@/lib/voice/field-runtime/save-voice-fast";
import { refreshSessionFieldState } from "@/lib/voice/realtime-session/init";
import type { RuntimeFieldManifestEntry } from "@/lib/voice/field-runtime/types";
import type { WorkflowState } from "@/lib/voice/workflow-engine/types";
import {
  domainCancelAppointment,
  domainCheckAvailability,
  domainConfirmBooking,
  domainFindAppointments,
  domainRescheduleAppointment,
  domainSelectSlot,
  type DomainActionResult,
  type LiveKitCallContext,
} from "@/lib/voice/domain-actions";
import { fieldsComplete } from "@/lib/voice/workflow-runtime/completion-guards";
import { compileToolsForCallContext } from "@/lib/voice/workflow-runtime/compile-for-call";
import { buildHeldSlotPayload, buildSlotsPayload } from "@/lib/voice/domain-actions/tool-results";

type SchedulingPhase =
  | "collect"
  | "availability"
  | "select"
  | "confirm"
  | "find"
  | "reschedule"
  | "cancel";

const PHASE_ALIGNMENT: Record<SchedulingPhase, { state: WorkflowState; nodeId: string }> = {
  collect: { state: "COLLECTING_FIELDS", nodeId: "collect_fields" },
  availability: { state: "CHECKING_AVAILABILITY", nodeId: "check_availability" },
  select: { state: "SELECTING_SLOT", nodeId: "select_slot" },
  confirm: { state: "READY_TO_BOOK", nodeId: "confirm_booking" },
  find: { state: "COLLECTING_FIELDS", nodeId: "reschedule_lookup" },
  reschedule: { state: "SELECTING_SLOT", nodeId: "select_slot" },
  cancel: { state: "READY_TO_BOOK", nodeId: "cancel_confirm" },
};

export function alignCallContext(ctx: LiveKitCallContext, phase: SchedulingPhase): LiveKitCallContext {
  const { state, nodeId } = PHASE_ALIGNMENT[phase];
  ctx.session.currentState = state;
  ctx.session.currentNodeId = nodeId;
  ctx.session.runtime.current_node_id = nodeId;
  compileToolsForCallContext(ctx);
  return ctx;
}

export function missingRequiredFields(ctx: LiveKitCallContext): RuntimeFieldManifestEntry[] {
  return ctx.session.fieldManifest.filter(
    (field) => field.required && !ctx.session.collectedFields[field.field_id]?.trim(),
  );
}

export async function recordCallerField(
  ctx: LiveKitCallContext,
  value: string,
  fieldId?: string,
): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult }> {
  alignCallContext(ctx, "collect");
  const activeFieldId =
    fieldId ||
    ctx.session.activeField ||
    missingRequiredFields(ctx)[0]?.field_id ||
    "";
  if (!activeFieldId) {
    return {
      ctx,
      result: {
        ok: false,
        speak: "I already have the details I need.",
        error_code: "NO_ACTIVE_FIELD",
      },
    };
  }

  const recorded = await recordFieldForLiveKitVoice({
    amySession: ctx.session,
    value,
    fieldId: activeFieldId,
  });
  if (!recorded.ok) {
    return {
      ctx,
      result: {
        ok: false,
        speak: recorded.speak,
        error_code: recorded.error_code,
      },
    };
  }

  ctx.session = refreshSessionFieldState(recorded.amySession);
  ctx.workflowState = recorded.workflowState;
  compileToolsForCallContext(ctx);
  return {
    ctx,
    result: {
      ok: true,
      speak: recorded.speak,
      workflow_state: recorded.workflowState,
    },
  };
}

export async function ensureCallerFieldsComplete(ctx: LiveKitCallContext): Promise<LiveKitCallContext> {
  return fieldsComplete(ctx.session) ? ctx : ctx;
}

export async function loadAvailableSlots(
  ctx: LiveKitCallContext,
  spoken = "next available",
): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult; slots: ReturnType<typeof buildSlotsPayload> }> {
  alignCallContext(ctx, "availability");
  const result = await domainCheckAvailability({ ctx, spoken });
  compileToolsForCallContext(ctx);
  return {
    ctx,
    result,
    slots: buildSlotsPayload(ctx.session),
  };
}

export async function holdAppointmentSlot(
  ctx: LiveKitCallContext,
  slotId: string,
): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult }> {
  alignCallContext(ctx, "select");
  const result = await domainSelectSlot({
    ctx,
    utterance: slotId,
    slotIso: slotId,
  });
  compileToolsForCallContext(ctx);
  return { ctx, result };
}

export async function commitBooking(
  ctx: LiveKitCallContext,
  confirmed: boolean,
): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult }> {
  alignCallContext(ctx, "confirm");
  const result = await domainConfirmBooking({ ctx, confirmed });
  compileToolsForCallContext(ctx);
  return { ctx, result };
}

export async function findCallerAppointments(
  ctx: LiveKitCallContext,
): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult }> {
  alignCallContext(ctx, "find");
  const result = await domainFindAppointments({ ctx });
  compileToolsForCallContext(ctx);
  return { ctx, result };
}

export async function rescheduleHeldAppointment(
  ctx: LiveKitCallContext,
  appointmentId: string,
  newSlotId: string,
  confirmed: boolean,
): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult }> {
  alignCallContext(ctx, "reschedule");
  const result = await domainRescheduleAppointment({
    ctx,
    appointmentId,
    newStartsAt: newSlotId,
    confirmed,
  });
  compileToolsForCallContext(ctx);
  return { ctx, result };
}

export async function cancelCallerAppointment(
  ctx: LiveKitCallContext,
  appointmentId: string,
  confirmed: boolean,
): Promise<{ ctx: LiveKitCallContext; result: DomainActionResult }> {
  alignCallContext(ctx, "cancel");
  const result = await domainCancelAppointment({
    ctx,
    appointmentId,
    confirmed,
  });
  compileToolsForCallContext(ctx);
  return { ctx, result };
}

export function heldSlotSummary(ctx: LiveKitCallContext): string | null {
  const held = buildHeldSlotPayload(ctx.session);
  return held?.spokenLabel || null;
}
