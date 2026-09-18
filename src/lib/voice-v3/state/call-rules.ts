import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { RequiredRuntimeAction } from "../calendar/types";
import { shouldDispatchFindAvailability } from "../calendar/find-availability";
import { isSelectedSlotAuthoritative } from "../calendar/selected-slot";
import type { VoiceV3CallContext } from "./call-context";
import type { BookingPhase } from "../calendar/booking-types";

export interface VoiceV3RuleEvaluation {
  missingRequiredFields: string[];
  intakeComplete: boolean;
  hasSchedulingPreference: boolean;
  schedulingRequiresClarification: boolean;
  schedulingClarificationReason: string | null;
  schedulingClarificationPrompt: string | null;
  mayRunCalendarAction: boolean;
  mayFindAvailability: boolean;
  requiredAction: RequiredRuntimeAction;
  slotSelected: boolean;
  bookingPhase: BookingPhase;
  bookingReady: boolean;
  mayBook: boolean;
}

export function evaluateVoiceV3Rules(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
): VoiceV3RuleEvaluation {
  const missingRequiredFields = config.intakeFields
    .filter((field) => field.required)
    .filter((field) => {
      const value = ctx.intake.values[field.key]?.value;
      return !value || !value.trim();
    })
    .map((field) => field.key);

  const normalized = ctx.scheduling.normalized;
  const hasSchedulingPreference = Boolean(
    normalized &&
      normalized.precision !== "UNRESOLVED" &&
      (normalized.localDate || normalized.localStartDateTime || normalized.localEndDateTime),
  );

  const clarification = ctx.scheduling.clarification;
  const schedulingRequiresClarification = Boolean(clarification?.required);
  const schedulingClarificationReason = clarification?.reason ?? null;
  const schedulingClarificationPrompt = clarification?.prompt ?? null;

  const mayRunCalendarAction = hasSchedulingPreference && !schedulingRequiresClarification;

  const calendarConfigured = Boolean(config.calendar?.connectionId && config.calendar.calendarIds.length);
  const durationKnown = config.service.durationMinutes > 0;
  const serviceKnown = Boolean(config.service.id?.trim() && config.service.name?.trim());

  const mayFindAvailability =
    mayRunCalendarAction &&
    durationKnown &&
    calendarConfigured &&
    (ctx.dialog.activeGoal === "BOOK_APPOINTMENT" || hasSchedulingPreference);

  const selected = ctx.selection.selected;
  const offer = ctx.availability.activeOfferSet;
  const slotSelected = Boolean(
    selected &&
      offer &&
      isSelectedSlotAuthoritative(selected, {
        offerSetId: offer.offerSetId,
        schedulingGeneration: ctx.scheduling.generation,
      }),
  );

  const intakeComplete = missingRequiredFields.length === 0;
  const bookingConfirmed = ctx.booking.phase === "BOOKING_CONFIRMED" && Boolean(ctx.booking.confirmed);
  const bookingInProgress =
    ctx.booking.phase === "BOOKING_REVALIDATING" ||
    ctx.booking.phase === "BOOKING_CREATING" ||
    ctx.booking.phase === "BOOKING_OUTCOME_UNKNOWN";

  const bookingReady =
    slotSelected &&
    intakeComplete &&
    durationKnown &&
    serviceKnown &&
    calendarConfigured &&
    !schedulingRequiresClarification &&
    !bookingConfirmed &&
    !bookingInProgress;

  let bookingPhase: BookingPhase = ctx.booking.phase;
  if (bookingPhase === "NONE" && slotSelected) {
    bookingPhase = "SLOT_SELECTED";
  }

  let requiredAction: RequiredRuntimeAction = null;

  if (bookingReady) {
    requiredAction = "BOOK_APPOINTMENT";
  } else if (!slotSelected && !bookingConfirmed) {
    requiredAction = shouldDispatchFindAvailability(ctx, config, mayFindAvailability)
      ? "FIND_AVAILABILITY"
      : null;
  }

  return {
    missingRequiredFields,
    intakeComplete,
    hasSchedulingPreference,
    schedulingRequiresClarification,
    schedulingClarificationReason,
    schedulingClarificationPrompt,
    mayRunCalendarAction,
    mayFindAvailability,
    requiredAction,
    slotSelected,
    bookingPhase,
    bookingReady,
    mayBook: bookingReady,
  };
}
