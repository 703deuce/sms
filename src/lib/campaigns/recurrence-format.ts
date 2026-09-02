import type { BroadcastRecurrence } from "@/lib/mass-texting/broadcast/types";

export type ComposeRecurrence = BroadcastRecurrence & {
  runsCompleted?: number;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function to24Hour(hour: number, ampm: "AM" | "PM"): number {
  if (ampm === "PM" && hour < 12) return hour + 12;
  if (ampm === "AM" && hour === 12) return 0;
  return hour;
}

export function setSendTime(date: Date, rec: Pick<BroadcastRecurrence, "sendHour" | "sendMinute" | "ampm">): Date {
  const next = new Date(date);
  next.setHours(to24Hour(rec.sendHour, rec.ampm), rec.sendMinute, 0, 0);
  return next;
}

export function addRecurrenceInterval(date: Date, rec: BroadcastRecurrence): Date {
  if (rec.unit === "days") {
    const next = new Date(date);
    next.setDate(next.getDate() + rec.interval);
    return setSendTime(next, rec);
  }

  if (rec.unit === "weeks") {
    const weekdays = rec.weekdays?.length ? rec.weekdays : [date.getDay()];
    for (let dayOffset = 1; dayOffset <= 7 * rec.interval + 7; dayOffset++) {
      const probe = new Date(date);
      probe.setDate(probe.getDate() + dayOffset);
      if (!weekdays.includes(probe.getDay())) continue;
      const weeksSinceStart = Math.floor(dayOffset / 7);
      if (weeksSinceStart > 0 && weeksSinceStart % rec.interval !== 0 && dayOffset >= 7) {
        continue;
      }
      return setSendTime(probe, rec);
    }
    const fallback = new Date(date);
    fallback.setDate(fallback.getDate() + 7 * rec.interval);
    return setSendTime(fallback, rec);
  }

  const next = new Date(date);
  next.setMonth(next.getMonth() + rec.interval);
  return setSendTime(next, rec);
}

export function computeBroadcastNextRun(
  rec: ComposeRecurrence,
  after: Date = new Date(),
): Date | null {
  let candidate = setSendTime(new Date(rec.startDate), rec);

  if (rec.unit === "weeks" && rec.weekdays?.length && !rec.weekdays.includes(candidate.getDay())) {
    for (let i = 1; i <= 7; i++) {
      const probe = new Date(candidate);
      probe.setDate(probe.getDate() + i);
      if (rec.weekdays.includes(probe.getDay())) {
        candidate = setSendTime(probe, rec);
        break;
      }
    }
  }

  let guard = 0;
  while (candidate.getTime() <= after.getTime() && guard++ < 400) {
    candidate = addRecurrenceInterval(candidate, rec);
  }

  if (rec.endMode === "on" && rec.endDate) {
    const end = new Date(rec.endDate);
    end.setHours(23, 59, 59, 999);
    if (candidate.getTime() > end.getTime()) return null;
  }

  if (rec.endMode === "after" && rec.endAfter != null) {
    const completed = rec.runsCompleted ?? 0;
    if (completed >= rec.endAfter) return null;
  }

  return candidate;
}

export function formatRecurrenceSummary(rec: BroadcastRecurrence, timezone?: string): string {
  const hourLabel =
    rec.sendHour === 0
      ? `12:${String(rec.sendMinute).padStart(2, "0")} ${rec.ampm}`
      : `${rec.sendHour}:${String(rec.sendMinute).padStart(2, "0")} ${rec.ampm}`;

  const unitLabel =
    rec.unit === "days"
      ? rec.interval === 1
        ? "day"
        : `${rec.interval} days`
      : rec.unit === "weeks"
        ? rec.interval === 1
          ? "week"
          : `${rec.interval} weeks`
        : rec.interval === 1
          ? "month"
          : `${rec.interval} months`;

  const weekdayPart =
    rec.unit === "weeks" && rec.weekdays?.length
      ? ` on ${rec.weekdays.map((d) => WEEKDAY_LABELS[d] ?? "").filter(Boolean).join(", ")}`
      : "";

  const start = new Date(rec.startDate).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  let ending = "never ends";
  if (rec.endMode === "on" && rec.endDate) {
    ending = `ends on ${new Date(rec.endDate).toLocaleDateString()}`;
  } else if (rec.endMode === "after" && rec.endAfter) {
    ending = `ends after ${rec.endAfter} sends`;
  }

  const tz = timezone || rec.timezone;
  return `Sends every ${unitLabel}${weekdayPart} at ${hourLabel} (${tz}) starting ${start} and ${ending}.`;
}

export function validateRecurrence(rec: BroadcastRecurrence | undefined): string | null {
  if (!rec) return "Configure recurring schedule settings.";
  if (!rec.startDate) return "Select a start date.";
  if (!rec.interval || rec.interval < 1) return "Repeat interval must be at least 1.";
  if (rec.unit === "weeks" && rec.weekdays?.length === 0) {
    return "Select at least one weekday.";
  }
  if (rec.sendHour < 1 || rec.sendHour > 12) return "Select a valid send time.";
  if (rec.sendMinute < 0 || rec.sendMinute > 59) return "Select a valid send time.";
  if (rec.endMode === "on" && !rec.endDate) return "Select an end date.";
  if (rec.endMode === "after" && (!rec.endAfter || rec.endAfter < 1)) {
    return "Enter how many sends before ending.";
  }
  const firstRun = computeBroadcastNextRun(rec, new Date(0));
  if (!firstRun) return "Recurrence settings do not produce any future sends.";
  if (firstRun.getTime() <= Date.now()) {
    return "First recurring send must be in the future.";
  }
  return null;
}

export function defaultRecurrence(timezone: string): BroadcastRecurrence {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    startDate: tomorrow.toISOString().slice(0, 10),
    interval: 1,
    unit: "weeks",
    sendHour: 9,
    sendMinute: 0,
    ampm: "AM",
    timezone,
    endMode: "never",
    weekdays: [tomorrow.getDay()],
  };
}
