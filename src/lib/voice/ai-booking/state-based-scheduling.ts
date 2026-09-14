import "server-only";

import type { MctbAiBookingSession, MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { MctbSemanticConversationContext } from "@/lib/mctb/semantic-conversation-context";
import type { WorkflowFieldSession } from "@/lib/voice/field-runtime/types";

const EARLY_BOOKING_STAGES = new Set([
  undefined,
  null,
  "IDLE",
  "COLLECTING_TIME_PREFERENCE",
]);

function sessionIsAtBookingStart(session: MctbAiBookingSession | null | undefined): boolean {
  if (!session) return true;
  if ((session.offeredSlots?.length ?? 0) > 0) return false;
  return EARLY_BOOKING_STAGES.has(session.stage ?? null);
}

function structuredStateRequestsConcreteTime(
  ctx: MctbSemanticConversationContext | null | undefined,
): boolean {
  if (!ctx) return false;
  const s = ctx.structured_state;
  if (s.last_queried_window) return true;
  if (s.pending_slot_id) return true;
  if (s.offered_slots.length > 0) return true;
  const collected = s.collected_fields;
  for (const key of ["preferred_time", "requested_time", "appointment_time", "DATE", "TIME"]) {
    if (collected[key]?.trim()) return true;
  }
  return false;
}

function bookingIntentFromStructuredState(
  ctx: MctbSemanticConversationContext | null | undefined,
): boolean {
  if (!ctx) return false;
  const s = ctx.structured_state;
  if (s.active_workflow === "BOOKING" || s.booking_session_active) return true;
  const intent = (s.last_primary_intent || "").toUpperCase();
  return intent === "BOOKING_REQUEST" || intent === "SPECIFIC_TIME_REQUEST";
}

function bookingIntentFromVoiceWorkflow(
  voiceWorkflow: WorkflowFieldSession | null | undefined,
): boolean {
  return voiceWorkflow?.workflow === "book_appointment";
}

/**
 * Deterministic scheduling action from runtime state — no phrase/regex matching.
 * Used to skip the scheduling specialist LLM on the first generic booking turn when
 * the workflow is already in book_appointment / BOOKING_REQUEST with no time constraint.
 */
export function buildStateBasedInitialAvailabilitySpecialist(input: {
  timezone: string;
  nowIso: string;
  semanticContext?: MctbSemanticConversationContext | null;
  voiceWorkflow?: WorkflowFieldSession | null;
  session?: MctbAiBookingSession | null;
  offeredSlots: MctbBookingSlot[];
  offeredSlotId?: string | null;
  confirmBooking?: boolean;
}): SchedulingSpecialistResult | null {
  if (input.offeredSlotId?.trim() || input.confirmBooking) return null;
  if (input.offeredSlots.length > 0) return null;
  if (!sessionIsAtBookingStart(input.session)) return null;
  if (structuredStateRequestsConcreteTime(input.semanticContext)) return null;

  const bookingIntent =
    bookingIntentFromVoiceWorkflow(input.voiceWorkflow) ||
    bookingIntentFromStructuredState(input.semanticContext);

  if (!bookingIntent) return null;

  const now = new Date(input.nowIso);
  const defaultEnd = new Date(now.getTime() + 48 * 3600_000);

  return {
    action: "CHECK_AVAILABILITY",
    timezone: input.timezone,
    needs_clarification: false,
    window_start: now.toISOString(),
    window_end: defaultEnd.toISOString(),
    requested_start: null,
    preferred_time: null,
  };
}
