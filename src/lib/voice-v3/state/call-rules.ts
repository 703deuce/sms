import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { RequiredRuntimeAction } from "../calendar/types";
import { shouldDispatchFindAvailability } from "../calendar/find-availability";
import { isSelectedSlotAuthoritative } from "../calendar/selected-slot";
import type { VoiceV3CallContext } from "./call-context";
import type { BookingPhase } from "../calendar/booking-types";
import type { CancellationPhase } from "../calendar/appointment-management-types";
import { deriveIntakeObjective } from "../intake-objective";
import { getMissingFieldsForOperation } from "../intake-objective/operation-requirements";
import { isQualificationBlockingCalendarActions } from "../qualification/evaluate-qualification";
import {
  resolveActiveServicePolicy,
  serviceAllowsLiveBooking,
  validateSlotAgainstServicePolicy,
} from "../policy/service-policy";

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
  findReady: boolean;
  rescheduleReady: boolean;
  cancellationPhase: CancellationPhase;
}

export function evaluateVoiceV3Rules(
  ctx: VoiceV3CallContext,
  config: VoiceV3AgentConfig,
): VoiceV3RuleEvaluation {
  const intakeObjective = deriveIntakeObjective(config, ctx);
  const missingRequiredFields = intakeObjective.missingRequiredFields;

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

  const activeService = resolveActiveServicePolicy(config, ctx);
  const calendarConfigured = Boolean(config.calendar?.connectionId && config.calendar.calendarIds.length);
  const durationKnown = activeService.durationMinutes > 0;
  const serviceKnown = Boolean(activeService.id?.trim() && activeService.name?.trim());
  const qualificationBlocks = isQualificationBlockingCalendarActions(config, ctx);
  const serviceBookable = serviceAllowsLiveBooking(activeService);

  const goal = ctx.dialog.activeGoal;

  const mayFindAvailability =
    mayRunCalendarAction &&
    durationKnown &&
    calendarConfigured &&
    serviceBookable &&
    !qualificationBlocks &&
    (goal === "BOOK_APPOINTMENT" ||
      goal === "RESCHEDULE_APPOINTMENT" ||
      hasSchedulingPreference);

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

  const intakeComplete = intakeObjective.status === "COMPLETE";
  const missingForBook = getMissingFieldsForOperation("book_appointment", config, ctx);
  const bookingConfirmed = ctx.booking.phase === "BOOKING_CONFIRMED" && Boolean(ctx.booking.confirmed);
  const bookingInProgress =
    ctx.booking.phase === "BOOKING_REVALIDATING" ||
    ctx.booking.phase === "BOOKING_CREATING" ||
    ctx.booking.phase === "BOOKING_OUTCOME_UNKNOWN";

  const isBookGoal = goal === "BOOK_APPOINTMENT";
  const slotPolicyOk =
    !selected?.startUtc ||
    !validateSlotAgainstServicePolicy({
      service: activeService,
      slotStartUtc: selected.startUtc,
      timezone: ctx.business.timezone,
    });

  const bookingReady =
    isBookGoal &&
    slotSelected &&
    missingForBook.length === 0 &&
    durationKnown &&
    serviceKnown &&
    calendarConfigured &&
    serviceBookable &&
    !qualificationBlocks &&
    slotPolicyOk &&
    !schedulingRequiresClarification &&
    !bookingConfirmed &&
    !bookingInProgress;

  let bookingPhase: BookingPhase = ctx.booking.phase;
  if (bookingPhase === "NONE" && slotSelected && isBookGoal) {
    bookingPhase = "SLOT_SELECTED";
  }

  const verifiedExisting = ctx.appointmentManagement.verifiedExisting;
  const rescheduleConfirmed =
    ctx.appointmentManagement.reschedule.phase === "RESCHEDULE_CONFIRMED";
  const rescheduleIntakeSatisfied =
    getMissingFieldsForOperation("reschedule_appointment", config, ctx).length === 0;
  const rescheduleReady =
    goal === "RESCHEDULE_APPOINTMENT" &&
    Boolean(verifiedExisting) &&
    slotSelected &&
    rescheduleIntakeSatisfied &&
    !schedulingRequiresClarification &&
    !rescheduleConfirmed &&
    ctx.appointmentManagement.reschedule.phase !== "RESCHEDULE_REVALIDATING" &&
    ctx.appointmentManagement.reschedule.phase !== "RESCHEDULE_COMMITTING";

  let cancellationPhase = ctx.appointmentManagement.cancellation.phase;
  const cancelGoal = goal === "CANCEL_APPOINTMENT";
  const cancelConfirmed = cancellationPhase === "CANCELLATION_CONFIRMED";

  if (
    cancelGoal &&
    verifiedExisting &&
    cancellationPhase === "NONE" &&
    !ctx.appointmentManagement.cancellation.awaitingConfirmation
  ) {
    cancellationPhase = "CANCELLATION_CONFIRMATION_REQUIRED";
  }

  const cancelReady =
    cancelGoal &&
    Boolean(verifiedExisting) &&
    ctx.appointmentManagement.lastCancellationConfirmation === "CONFIRM" &&
    ctx.appointmentManagement.cancellation.awaitingConfirmation &&
    verifiedExisting.providerEventId ===
      ctx.appointmentManagement.cancellation.boundProviderEventId &&
    !cancelConfirmed;

  let requiredAction: RequiredRuntimeAction = null;

  if (cancelGoal) {
    if (!verifiedExisting && !ctx.appointmentManagement.lookupCompleted) {
      requiredAction = "FIND_EXISTING_APPOINTMENT";
    } else if (cancelReady) {
      requiredAction = "CANCEL_APPOINTMENT";
    }
  } else if (goal === "RESCHEDULE_APPOINTMENT") {
    if (!verifiedExisting && !ctx.appointmentManagement.lookupCompleted) {
      requiredAction = "FIND_EXISTING_APPOINTMENT";
    } else if (rescheduleReady) {
      requiredAction = "RESCHEDULE_APPOINTMENT";
    } else if (verifiedExisting && !slotSelected && mayFindAvailability) {
      requiredAction = shouldDispatchFindAvailability(ctx, config, mayFindAvailability)
        ? "FIND_AVAILABILITY"
        : null;
    }
  } else if (bookingReady) {
    requiredAction = "BOOK_APPOINTMENT";
  } else if (!slotSelected && !bookingConfirmed && isBookGoal) {
    requiredAction = shouldDispatchFindAvailability(ctx, config, mayFindAvailability)
      ? "FIND_AVAILABILITY"
      : null;
  }

  const findReady = requiredAction === "FIND_AVAILABILITY";

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
    findReady,
    rescheduleReady,
    cancellationPhase,
  };
}
