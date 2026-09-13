import { aiBookingStructuredJson } from "@/lib/mctb/ai-booking/agents/json-llm";
import { SCHEDULING_SPECIALIST_SYSTEM } from "@/lib/mctb/ai-booking/agents/prompts";
import { getAiBookingSchedulerModel } from "@/lib/mctb/ai-booking/agents/model-config";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { SchedulingSpecialistResult, SchedulingSpecialistAction } from "@/lib/mctb/ai-booking/agents/types";
import { interpretSchedulingUtterance } from "@/lib/mctb/ai-booking/scheduling-interpreter";
import { resolveOfferedSlotChoice } from "@/lib/mctb/ai-booking/slot-presentation";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";

function normalizeSpecialist(raw: Record<string, unknown>, timezone: string): SchedulingSpecialistResult | null {
  const action = String(raw.action || "") as SchedulingSpecialistAction;
  if (!action) return null;
  return {
    action,
    window_start: raw.window_start ? String(raw.window_start) : null,
    window_end: raw.window_end ? String(raw.window_end) : null,
    requested_start: raw.requested_start ? String(raw.requested_start) : null,
    preferred_time: raw.preferred_time ? String(raw.preferred_time) : null,
    offered_slot_id: raw.offered_slot_id ? String(raw.offered_slot_id) : null,
    timezone: String(raw.timezone || timezone),
    needs_clarification: raw.needs_clarification === true,
    question_type: raw.question_type ? String(raw.question_type) : null,
    clarification_text: raw.clarification_text ? String(raw.clarification_text) : null,
  };
}

/** Deterministic specialist fallback — same layer, no provider calls. */
export function deterministicSchedulingSpecialist(input: {
  message: string;
  timezone: string;
  offeredSlots: MctbBookingSlot[];
  aiBookingSessionActive: boolean;
  now?: Date;
}): SchedulingSpecialistResult {
  const interp = interpretSchedulingUtterance({
    text: input.message,
    timezone: input.timezone,
    hasActiveBookingSession: input.aiBookingSessionActive,
    now: input.now,
  });

  if (interp.intent === "SELECT_OFFERED_SLOT" || interp.intent === "CONFIRM_BOOKING") {
    const slot = resolveOfferedSlotChoice(input.offeredSlots, input.message);
    return {
      action: interp.confirmBooking ? "CONFIRM_BOOKING" : "SELECT_OFFERED_SLOT",
      offered_slot_id: slot?.slotId ?? null,
      timezone: input.timezone,
      needs_clarification: !slot,
      clarification_text: slot ? null : "Which of the times I offered works best?",
    };
  }

  if (interp.needsClarification) {
    return {
      action: "ASK_CLARIFICATION",
      timezone: input.timezone,
      needs_clarification: true,
      question_type: "TIME_PREFERENCE",
      clarification_text: interp.clarificationHint || "Would morning or afternoon work better?",
    };
  }

  if (interp.preferredTimeUtc) {
    return {
      action: "CHECK_SPECIFIC_TIME",
      requested_start: interp.preferredTimeUtc,
      window_start: interp.windowStartUtc,
      window_end: interp.windowEndUtc,
      timezone: interp.timezone,
      needs_clarification: false,
    };
  }

  return {
    action: "CHECK_AVAILABILITY",
    window_start: interp.windowStartUtc,
    window_end: interp.windowEndUtc,
    timezone: interp.timezone,
    needs_clarification: false,
  };
}

export async function runSchedulingSpecialistAgent(input: {
  message: string;
  timezone: string;
  nowIso: string;
  offeredSlots: MctbBookingSlot[];
  aiBookingSessionActive: boolean;
  sessionStage?: string | null;
}): Promise<SchedulingSpecialistResult> {
  if (
    input.aiBookingSessionActive &&
    input.sessionStage === "AWAITING_SLOT_SELECTION"
  ) {
    const det = deterministicSchedulingSpecialist({
      message: input.message,
      timezone: input.timezone,
      offeredSlots: input.offeredSlots,
      aiBookingSessionActive: true,
    });
    logMctbAiBookingEvent("scheduler_action", { action: det.action, shortcut: true });
    return det;
  }

  const userPayload = JSON.stringify({
    latest_message: input.message,
    timezone: input.timezone,
    current_time_utc: input.nowIso,
    offered_slots: input.offeredSlots.map((s) => ({
      slot_id: s.slotId,
      start_utc: s.startUtc,
      end_utc: s.endUtc,
    })),
    session_stage: input.sessionStage,
  });

  const parsed = await aiBookingStructuredJson<Record<string, unknown>>({
    system: SCHEDULING_SPECIALIST_SYSTEM,
    user: userPayload,
    model: getAiBookingSchedulerModel(),
  });

  const normalized = parsed ? normalizeSpecialist(parsed, input.timezone) : null;
  const result =
    normalized ||
    deterministicSchedulingSpecialist({
      message: input.message,
      timezone: input.timezone,
      offeredSlots: input.offeredSlots,
      aiBookingSessionActive: input.aiBookingSessionActive,
    });

  logMctbAiBookingEvent("scheduler_action", {
    action: result.action,
    needs_clarification: result.needs_clarification,
  });

  return result;
}
