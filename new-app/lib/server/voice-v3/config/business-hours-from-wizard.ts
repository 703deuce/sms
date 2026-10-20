import type { BusinessScheduleConfig } from "@/lib/agent";
import type { BusinessHoursWindow } from "../calendar/types";

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const DAY_LABEL: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const JS_WEEKDAY: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function formatWeeklyHoursForAmy(schedule: BusinessScheduleConfig | null | undefined): string {
  if (!schedule?.weekly) return "";
  const lines: string[] = [];
  for (const day of DAY_ORDER) {
    const row = schedule.weekly[day];
    if (!row || row.closed || !row.ranges?.length) {
      lines.push(`${DAY_LABEL[day]}: Closed`);
      continue;
    }
    const ranges = row.ranges
      .map((r) => `${formatHm(r.start)} – ${formatHm(r.end)}`)
      .join(", ");
    lines.push(`${DAY_LABEL[day]}: ${ranges}`);
  }
  return lines.join("\n");
}

function formatHm(hhmm: string): string {
  const [h, m] = hhmm.split(":").map((x) => Number(x));
  if (Number.isNaN(h)) return hhmm;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${hour12} ${suffix}`;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Coarse scheduling window — first open range across enabled weekdays (deterministic enforcement baseline). */
export function businessHoursWindowFromWeeklySchedule(
  schedule: BusinessScheduleConfig | null | undefined,
  fallback: BusinessHoursWindow,
): BusinessHoursWindow {
  if (!schedule?.weekly) return fallback;
  const weekdays: number[] = [];
  let startLocal = fallback.startLocal;
  let endLocal = fallback.endLocal;

  for (const day of DAY_ORDER) {
    const row = schedule.weekly[day];
    if (!row || row.closed || !row.ranges?.length) continue;
    weekdays.push(JS_WEEKDAY[day]);
    const first = row.ranges[0];
    if (first?.start) startLocal = first.start;
    if (first?.end) endLocal = first.end;
  }

  if (weekdays.length === 0) return fallback;
  return { weekdays: [...new Set(weekdays)].sort(), startLocal, endLocal };
}
