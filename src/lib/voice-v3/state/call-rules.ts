import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { RequiredRuntimeAction } from "../calendar/types";
import { shouldDispatchFindAvailability } from "../calendar/find-availability";
import type { VoiceV3CallContext } from "./call-context";

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
  bookingPhase: "SLOT_SELECTED" | null;
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

  const mayFindAvailability =
    mayRunCalendarAction &&
    durationKnown &&
    calendarConfigured &&
    (ctx.dialog.activeGoal === "BOOK_APPOINTMENT" || hasSchedulingPreference);

  const slotSelected = Boolean(ctx.selection.selected);
  const bookingPhase = slotSelected ? "SLOT_SELECTED" : null;

  const requiredAction: RequiredRuntimeAction = slotSelected
    ? null
    : shouldDispatchFindAvailability(ctx, config, mayFindAvailability)
      ? "FIND_AVAILABILITY"
      : null;

  return {
    missingRequiredFields,
    intakeComplete: missingRequiredFields.length === 0,
    hasSchedulingPreference,
    schedulingRequiresClarification,
    schedulingClarificationReason,
    schedulingClarificationPrompt,
    mayRunCalendarAction,
    mayFindAvailability,
    requiredAction,
    slotSelected,
    bookingPhase,
    mayBook: false,
  };
}
