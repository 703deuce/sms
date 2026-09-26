import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { VoiceV3CallContext } from "../state/call-context";
import type {
  SchedulingMeaning,
  SchedulingWeekday,
  NormalizedSchedulingPreference,
} from "../time/scheduling-types";
import { zonedDateParts } from "../time/timezone";
import type {
  VoiceV2BusinessScheduleConfig,
  VoiceV2DayOfWeek,
} from "@/lib/voice-receptionist-wizard/operating-maturity/types";

export type EmptyAvailabilityReason = "CLOSED_WEEKDAY" | "NO_SLOTS_IN_RANGE" | "UNKNOWN";

export type EmptyAvailabilityGuidance = {
  reason: EmptyAvailabilityReason;
  requestedDayLabel: string | null;
  openDaysSummary: string | null;
  safeAgentMessage: string;
};

const DAY_ORDER: VoiceV2DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABEL: Record<VoiceV2DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const SCHEDULING_WEEKDAY_TO_DAY: Record<SchedulingWeekday, VoiceV2DayOfWeek> = {
  MONDAY: "monday",
  TUESDAY: "tuesday",
  WEDNESDAY: "wednesday",
  THURSDAY: "thursday",
  FRIDAY: "friday",
  SATURDAY: "saturday",
  SUNDAY: "sunday",
};

function isDayOpen(
  schedule: VoiceV2BusinessScheduleConfig,
  day: VoiceV2DayOfWeek,
): boolean {
  const row = schedule.weekly?.[day];
  return Boolean(row && !row.closed && row.ranges?.length);
}

function resolveRequestedDayKey(input: {
  meaning?: SchedulingMeaning;
  normalized?: NormalizedSchedulingPreference | null;
  timezone: string;
}): VoiceV2DayOfWeek | null {
  if (input.meaning?.weekday) {
    return SCHEDULING_WEEKDAY_TO_DAY[input.meaning.weekday] ?? null;
  }
  if (input.normalized?.localDate) {
    const [y, m, d] = input.normalized.localDate.split("-").map(Number);
    if (y && m && d) {
      const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      const weekdayLong = zonedDateParts(noonUtc, input.timezone).weekdayLong;
      const key = weekdayLong.slice(0, 3).toLowerCase();
      const map: Record<string, VoiceV2DayOfWeek> = {
        mon: "monday",
        tue: "tuesday",
        wed: "wednesday",
        thu: "thursday",
        fri: "friday",
        sat: "saturday",
        sun: "sunday",
      };
      return map[key] ?? null;
    }
  }
  if (!input.normalized?.utcStart) return null;
  const parts = zonedDateParts(new Date(input.normalized.utcStart), input.timezone);
  const weekdayLong = parts.weekdayLong;
  const key = weekdayLong.slice(0, 3).toLowerCase();
  const map: Record<string, VoiceV2DayOfWeek> = {
    mon: "monday",
    tue: "tuesday",
    wed: "wednesday",
    thu: "thursday",
    fri: "friday",
    sat: "saturday",
    sun: "sunday",
  };
  return map[key] ?? null;
}

/** Compact caller-facing summary of open days (e.g. "Monday through Friday"). */
export function summarizeOpenWeekdays(schedule: VoiceV2BusinessScheduleConfig): string | null {
  const open = DAY_ORDER.filter((d) => isDayOpen(schedule, d));
  if (open.length === 0) return null;
  if (open.length === 7) return "every day";

  const runs: string[][] = [];
  let run: string[] = [];
  for (const day of DAY_ORDER) {
    if (open.includes(day)) {
      run.push(DAY_LABEL[day]);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  const parts = runs.map((r) =>
    r.length >= 3 ? `${r[0]} through ${r[r.length - 1]}` : r.join(", "),
  );
  return parts.join("; ");
}

export function buildEmptyAvailabilityGuidance(
  config: VoiceV3AgentConfig,
  ctx: Pick<VoiceV3CallContext, "scheduling" | "business">,
): EmptyAvailabilityGuidance {
  const schedule = config.operatingPolicy?.businessSchedule;
  const hoursDisplay = config.business.hoursDisplay?.trim();
  const timezone = ctx.business.timezone || config.timezone;

  const requestedDay = schedule
    ? resolveRequestedDayKey({
        meaning: ctx.scheduling.meaning,
        normalized: ctx.scheduling.normalized,
        timezone,
      })
    : null;

  const openDaysSummary = schedule ? summarizeOpenWeekdays(schedule) : null;
  const requestedDayLabel = requestedDay ? DAY_LABEL[requestedDay] : null;

  if (schedule && requestedDay && !isDayOpen(schedule, requestedDay)) {
    const openPart = openDaysSummary
      ? `We schedule appointments ${openDaysSummary}.`
      : hoursDisplay
        ? `Our appointment hours are:\n${hoursDisplay}`
        : "That day is outside our appointment schedule.";
    const safeAgentMessage =
      `The caller asked for ${requestedDayLabel}, which is not an appointment day for this business. ` +
      `Tell them clearly we are not open for appointments that day. ${openPart} ` +
      `Ask which open day works for them. Do not treat this as a system error or suggest a callback unless they ask for one.`;

    return {
      reason: "CLOSED_WEEKDAY",
      requestedDayLabel,
      openDaysSummary,
      safeAgentMessage,
    };
  }

  const hoursHint = hoursDisplay
    ? `Use these business hours when helpful:\n${hoursDisplay}`
    : openDaysSummary
      ? `Open days for appointments: ${openDaysSummary}.`
      : "";

  const dayPhrase = requestedDayLabel ? ` on ${requestedDayLabel}` : "";

  return {
    reason: requestedDay ? "NO_SLOTS_IN_RANGE" : "UNKNOWN",
    requestedDayLabel,
    openDaysSummary,
    safeAgentMessage:
      `No appointment times matched the caller's request${dayPhrase}. ` +
      `Do not invent times. ${hoursHint} ` +
      `Explain naturally and ask for another day or time that fits the schedule. ` +
      `Do not treat this as a system failure or push a callback unless the caller wants one.`,
  };
}
