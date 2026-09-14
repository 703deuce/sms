import { aiBookingStructuredJson } from "@/lib/mctb/ai-booking/agents/json-llm";
import { SCHEDULING_SPECIALIST_SYSTEM } from "@/lib/mctb/ai-booking/agents/prompts";
import { mctbSemanticModelId } from "@/lib/mctb/semantic-llm";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import type { SchedulingSpecialistResult, SchedulingSpecialistAction } from "@/lib/mctb/ai-booking/agents/types";
import { logMctbAiBookingEvent } from "@/lib/mctb/ai-booking/observability";
import { buildSchedulingSpecialistUserPayload } from "@/lib/mctb/ai-booking/agents/scheduling-context";
import type { MctbAiBookingSession } from "@/lib/mctb/ai-booking/types";
import type { MctbAiBookingWorkspaceConfig } from "@/lib/mctb/ai-booking/config";
import type { MctbSemanticConversationContext } from "@/lib/mctb/semantic-conversation-context";
import { referenceLocalDates } from "@/lib/mctb/ai-booking/local-time-semantics";

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
    offered_slot_index:
      raw.offered_slot_index != null && Number.isFinite(Number(raw.offered_slot_index))
        ? Number(raw.offered_slot_index)
        : null,
    timezone: String(raw.timezone || timezone),
    needs_clarification: raw.needs_clarification === true,
    customer_confirms_booking: raw.customer_confirms_booking === true,
    customer_rejects_selection: raw.customer_rejects_selection === true,
    is_correction: raw.is_correction === true,
    requested_local_date: raw.requested_local_date ? String(raw.requested_local_date) : null,
    requested_local_time: raw.requested_local_time ? String(raw.requested_local_time) : null,
    time_relation: raw.time_relation ? (String(raw.time_relation) as SchedulingSpecialistResult["time_relation"]) : null,
    daypart: raw.daypart ? (String(raw.daypart) as SchedulingSpecialistResult["daypart"]) : null,
    time_specificity: raw.time_specificity
      ? (String(raw.time_specificity) as SchedulingSpecialistResult["time_specificity"])
      : null,
    question_type: raw.question_type ? String(raw.question_type) : null,
    clarification_text: raw.clarification_text ? String(raw.clarification_text) : null,
  };
}

function certNow(): Date {
  const fixed = process.env.LR_CERT_E2E_NOW?.trim();
  if (fixed) {
    const d = new Date(fixed);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Repair invalid UTC windows — prefer semantic local date (runtime), not LLM UTC bands. */
function repairCheckAvailabilityWindow(
  result: SchedulingSpecialistResult,
  timezone: string,
  referenceUtcIso: string,
): SchedulingSpecialistResult {
  if (result.action !== "CHECK_AVAILABILITY") return result;
  if (result.requested_local_date?.trim()) {
    return {
      ...result,
      timezone,
      window_start: null,
      window_end: null,
      needs_clarification: false,
      question_type: null,
      clarification_text: null,
    };
  }
  const startMs = result.window_start ? Date.parse(result.window_start) : NaN;
  const endMs = result.window_end ? Date.parse(result.window_end) : NaN;
  if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs) {
    return result;
  }
  const { tomorrow_local_date } = referenceLocalDates(referenceUtcIso, timezone);
  return {
    ...result,
    timezone,
    requested_local_date: tomorrow_local_date,
    time_specificity: "DATE_ONLY",
    window_start: null,
    window_end: null,
    needs_clarification: false,
    question_type: null,
    clarification_text: null,
  };
}

function applySchedulingReferenceDates(
  result: SchedulingSpecialistResult,
  referenceUtcIso: string,
  timezone: string,
  bookingAuthorized: boolean,
): SchedulingSpecialistResult {
  if (!bookingAuthorized || result.action !== "CHECK_AVAILABILITY") return result;
  if (result.requested_local_date?.trim()) return result;
  const { tomorrow_local_date } = referenceLocalDates(referenceUtcIso, timezone);
  return {
    ...result,
    requested_local_date: tomorrow_local_date,
    time_specificity: result.time_specificity || "DATE_ONLY",
  };
}

function modelUnavailableResult(timezone: string): SchedulingSpecialistResult {
  return {
    action: "ASK_CLARIFICATION",
    timezone,
    needs_clarification: true,
    question_type: "MODEL_UNAVAILABLE",
    clarification_text: "I'm having trouble understanding — what day or time works best?",
  };
}

export async function runSchedulingSpecialistAgent(input: {
  message: string;
  timezone: string;
  nowIso: string;
  offeredSlots: MctbBookingSlot[];
  aiBookingSessionActive: boolean;
  sessionStage?: string | null;
  session?: MctbAiBookingSession | null;
  bookingConfig?: MctbAiBookingWorkspaceConfig | null;
  semanticContext?: MctbSemanticConversationContext | null;
  /** Lead Recovery already authorized AI_BOOK — prefer CHECK_AVAILABILITY over over-clarifying. */
  bookingAuthorized?: boolean;
}): Promise<SchedulingSpecialistResult> {
  const userPayload = buildSchedulingSpecialistUserPayload({
    message: input.message,
    timezone: input.timezone,
    nowIso: input.nowIso,
    offeredSlots: input.offeredSlots,
    aiBookingSessionActive: input.aiBookingSessionActive,
    sessionStage: input.sessionStage,
    session: input.session,
    bookingConfig: input.bookingConfig,
    semanticContext: input.semanticContext,
    bookingAuthorized: input.bookingAuthorized,
  });

  const invoke = async (extraSystem?: string) =>
    aiBookingStructuredJson<Record<string, unknown>>({
      system: extraSystem ? `${SCHEDULING_SPECIALIST_SYSTEM}\n${extraSystem}` : SCHEDULING_SPECIALIST_SYSTEM,
      user: userPayload,
      model: mctbSemanticModelId(),
    });

  const selectionSessionActive =
    input.aiBookingSessionActive && (input.offeredSlots?.length ?? 0) > 0;

  let parsed = selectionSessionActive
    ? await invoke(
        "Active offered_slots in structured_state. Interpret latest_message as slot selection only unless customer clearly rejects all offers or asks for a different day. Return SELECT_OFFERED_SLOT or CONFIRM_BOOKING with offered_slot_index (1-based) and/or offered_slot_id from structured_state.offered_slots. Set customer_confirms_booking true when they affirm (works, yes, perfect, book it).",
      )
    : await invoke();
  let normalized = parsed ? normalizeSpecialist(parsed, input.timezone) : null;
  let result = normalized ?? modelUnavailableResult(input.timezone);

  if (
    selectionSessionActive &&
    result.action !== "SELECT_OFFERED_SLOT" &&
    result.action !== "CONFIRM_BOOKING" &&
    (result.action === "ASK_CLARIFICATION" || result.action === "CHECK_AVAILABILITY")
  ) {
    parsed = await invoke(
      "An active booking session exists with offered_slots in structured_state. Interpret latest_message as slot selection, time confirmation, or correction. For '3 PM works' / 'yes' / 'that works' → SELECT_OFFERED_SLOT or CONFIRM_BOOKING with offered_slot_index or requested_local_time 15:00 on the offered day, customer_confirms_booking true. Prefer SELECT_OFFERED_SLOT with offered_slot_index. Set customer_confirms_booking when they affirm a time.",
    );
    normalized = parsed ? normalizeSpecialist(parsed, input.timezone) : null;
    if (normalized) result = normalized;
  }

  if (
    input.bookingAuthorized &&
    result.action === "ASK_CLARIFICATION" &&
    !input.aiBookingSessionActive
  ) {
    parsed = await invoke(
      "booking_already_authorized is TRUE — return CHECK_AVAILABILITY with requested_local_date (use tomorrow_local_date from input when they said tomorrow), and requested_local_time + time_relation AFTER/BEFORE/AT when they constrain time. Do NOT return ASK_CLARIFICATION. Do NOT rely on UTC window_start/window_end.",
    );
    normalized = parsed ? normalizeSpecialist(parsed, input.timezone) : null;
    if (normalized) result = normalized;
  }

  result = applySchedulingReferenceDates(
    result,
    input.nowIso,
    input.timezone,
    input.bookingAuthorized === true,
  );

  if (result.action === "CHECK_AVAILABILITY") {
    result = repairCheckAvailabilityWindow(result, input.timezone, input.nowIso);
  }

  logMctbAiBookingEvent("scheduler_action", {
    action: result.action,
    needs_clarification: result.needs_clarification,
    provider: "deepseek",
  });

  return result;
}
