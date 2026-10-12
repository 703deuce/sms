import type { AppointmentPlatformConfig, DateOverride, ReminderStepConfig } from "@/lib/appointments/types";
import type { WeeklyHours } from "@/lib/appointments/availability-engine-policy";
import { shouldSkipReminderSendNow } from "@/lib/appointment-reminders/reminder-send-time-policy";

function resolveStepFireTime(step: ReminderStepConfig, startsAt: Date): Date {
  if (step.timeOfDay) {
    const [hh, mm] = step.timeOfDay.at.split(":").map(Number);
    const fire = new Date(startsAt);
    fire.setDate(fire.getDate() - (step.timeOfDay.daysBefore || 0));
    fire.setHours(hh || 9, mm || 0, 0, 0);
    return fire;
  }
  const mins = step.minutesBefore || 0;
  return new Date(startsAt.getTime() - mins * 60_000);
}

/** Max calendar lookback when shifting a deferred send earlier than the nominal offset. */
export const REMINDER_DEFER_MAX_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/** Avoid stacking a timed reminder immediately on top of booking confirmation SMS. */
export const REMINDER_MIN_GAP_AFTER_CONFIRMATION_MS = 30 * 60_000;

const SEARCH_STEP_MS = 5 * 60_000;

export type ReminderSendTimeContext = {
  step: ReminderStepConfig;
  weeklyHours: WeeklyHours;
  timezone: string;
  dateOverrides?: DateOverride[];
  reminderQuietHours?: AppointmentPlatformConfig["reminderQuietHours"];
};

export function stepUsesSendTimeRestrictions(step: ReminderStepConfig): boolean {
  return Boolean(step.skipWeekends || step.skipClosedDays || step.skipOffHours);
}

export function isReminderSendAllowedAt(fireAt: Date, ctx: ReminderSendTimeContext): boolean {
  return !shouldSkipReminderSendNow({
    step: ctx.step,
    fireAt,
    weeklyHours: ctx.weeklyHours,
    timezone: ctx.timezone,
    dateOverrides: ctx.dateOverrides,
    reminderQuietHours: ctx.reminderQuietHours,
  });
}

function latestAllowedAtOrBefore(
  target: Date,
  lowerBound: Date,
  ctx: ReminderSendTimeContext,
): Date | null {
  const minMs = lowerBound.getTime();
  let t = target.getTime();
  while (t >= minMs) {
    const candidate = new Date(t);
    if (isReminderSendAllowedAt(candidate, ctx)) return candidate;
    t -= SEARCH_STEP_MS;
  }
  return null;
}

function earliestAllowedAfter(
  after: Date,
  upperBound: Date,
  ctx: ReminderSendTimeContext,
): Date | null {
  const maxMs = upperBound.getTime();
  let t = after.getTime() + SEARCH_STEP_MS;
  while (t < maxMs) {
    const candidate = new Date(t);
    if (isReminderSendAllowedAt(candidate, ctx)) return candidate;
    t += SEARCH_STEP_MS;
  }
  return null;
}

export type EffectiveReminderFireTime = {
  effectiveFireAt: Date;
  nominalFireAt: Date;
  deferred: boolean;
  strategy: "nominal" | "latest_before_nominal" | "earliest_after_booking";
};

export type UnresolvedReminderFireTime = {
  nominalFireAt: Date;
  reason: "no_allowed_window";
};

/**
 * Deterministic effective send instant for timed reminder steps.
 * When send-time restrictions block the nominal offset, shift to the latest
 * permitted time before the nominal instant; if impossible (e.g. booked too late),
 * use the earliest permitted time after booking and before the appointment.
 */
export function resolveEffectiveReminderFireTime(input: {
  step: ReminderStepConfig;
  startsAt: Date;
  createdAt: Date;
  weeklyHours: WeeklyHours;
  timezone: string;
  dateOverrides?: DateOverride[];
  reminderQuietHours?: AppointmentPlatformConfig["reminderQuietHours"];
  /** When true, do not schedule closer than REMINDER_MIN_GAP_AFTER_CONFIRMATION_MS after booking. */
  confirmationStepEnabled?: boolean;
  /** Booking confirmation — fires at import/create time, not at appointment start. */
  immediate?: boolean;
}): EffectiveReminderFireTime | UnresolvedReminderFireTime {
  const nominalFireAt = input.immediate
    ? input.createdAt
    : resolveStepFireTime(input.step, input.startsAt);
  const ctx: ReminderSendTimeContext = {
    step: input.step,
    weeklyHours: input.weeklyHours,
    timezone: input.timezone || "America/New_York",
    dateOverrides: input.dateOverrides,
    reminderQuietHours: input.reminderQuietHours,
  };

  if (!stepUsesSendTimeRestrictions(input.step)) {
    return {
      effectiveFireAt: nominalFireAt,
      nominalFireAt,
      deferred: false,
      strategy: "nominal",
    };
  }

  if (isReminderSendAllowedAt(nominalFireAt, ctx)) {
    return {
      effectiveFireAt: nominalFireAt,
      nominalFireAt,
      deferred: false,
      strategy: "nominal",
    };
  }

  const bookingFloor = input.confirmationStepEnabled
    ? input.createdAt.getTime() + REMINDER_MIN_GAP_AFTER_CONFIRMATION_MS
    : input.createdAt.getTime();

  const lowerBound = new Date(
    Math.max(
      bookingFloor,
      nominalFireAt.getTime() - REMINDER_DEFER_MAX_LOOKBACK_MS,
      input.startsAt.getTime() - REMINDER_DEFER_MAX_LOOKBACK_MS,
    ),
  );

  const latestBefore = latestAllowedAtOrBefore(
    new Date(nominalFireAt.getTime() - SEARCH_STEP_MS),
    lowerBound,
    ctx,
  );
  if (latestBefore) {
    return {
      effectiveFireAt: latestBefore,
      nominalFireAt,
      deferred: true,
      strategy: "latest_before_nominal",
    };
  }

  const earliestAfter = earliestAllowedAfter(lowerBound, input.startsAt, ctx);
  if (earliestAfter) {
    return {
      effectiveFireAt: earliestAfter,
      nominalFireAt,
      deferred: true,
      strategy: "earliest_after_booking",
    };
  }

  return { nominalFireAt, reason: "no_allowed_window" };
}

/** Clamp an already-resolved effective time so it respects the post-confirmation gap. */
export function clampEffectiveFireAfterConfirmationGap(input: {
  effectiveFireAt: Date;
  createdAt: Date;
  startsAt: Date;
  confirmationStepEnabled?: boolean;
  ctx: ReminderSendTimeContext;
}): Date {
  if (!input.confirmationStepEnabled) return input.effectiveFireAt;
  const floor = input.createdAt.getTime() + REMINDER_MIN_GAP_AFTER_CONFIRMATION_MS;
  if (input.effectiveFireAt.getTime() >= floor) return input.effectiveFireAt;
  const bumped = earliestAllowedAfter(new Date(floor), input.startsAt, input.ctx);
  return bumped || input.effectiveFireAt;
}
