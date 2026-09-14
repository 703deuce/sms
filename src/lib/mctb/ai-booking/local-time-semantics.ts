import type { SchedulingSpecialistResult } from "@/lib/mctb/ai-booking/agents/types";
import type { MctbBookingSlot } from "@/lib/mctb/ai-booking/types";
import { findSlotAtTime } from "@/lib/mctb/ai-booking/slot-presentation";

/** Calendar date YYYY-MM-DD for an instant in an IANA timezone. */
export function localDateInTimeZone(isoUtc: string, timeZone: string): string {
  const d = new Date(isoUtc);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !day) return "";
  return `${y}-${m}-${day}`;
}

/** Add calendar days in business-local semantics (cert-safe; runtime authority). */
export function localDatePlusDays(isoUtc: string, timeZone: string, days: number): string {
  const base = localDateInTimeZone(isoUtc, timeZone);
  if (!base) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!m) return "";
  const anchor = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days, 12, 0, 0));
  return localDateInTimeZone(anchor.toISOString(), timeZone);
}

export function referenceLocalDates(isoUtc: string, timeZone: string): {
  today_local_date: string;
  tomorrow_local_date: string;
} {
  const today = localDateInTimeZone(isoUtc, timeZone);
  const tomorrow = localDatePlusDays(isoUtc, timeZone, 1);
  return { today_local_date: today, tomorrow_local_date: tomorrow };
}

/** Match an offered provider slot from semantic local wall time (not raw SMS regex). */
export function resolveOfferedSlotIdByLocalWallTime(input: {
  offeredSlots: MctbBookingSlot[];
  localDate: string;
  localTime: string;
  timeZone: string;
}): string | null {
  const utc = localWallTimeToUtcIso(input.localDate, input.localTime, input.timeZone);
  if (!utc) return null;
  const slot = findSlotAtTime(input.offeredSlots, utc);
  return slot?.slotId ?? null;
}

/** Convert local wall time in IANA timezone to UTC ISO (runtime authority — not LLM). */
export function localWallTimeToUtcIso(localDate: string, localTime: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(localTime.trim());
  if (!m || !t) return null;
  const hour = Number(t[1]);
  const minute = Number(t[2]);
  if (hour > 23 || minute > 59) return null;

  const asUtc = new Date(`${m[1]}-${m[2]}-${m[3]}T${String(hour).padStart(2, "0")}:${t[2]}:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const targetMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, minute);
  for (let offsetHours = -14; offsetHours <= 14; offsetHours++) {
    const candidate = new Date(targetMs - offsetHours * 3600_000);
    const parts = formatter.formatToParts(candidate);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const y = get("year");
    const mo = get("month");
    const d = get("day");
    const h = get("hour");
    const mi = get("minute");
    if (`${y}-${mo}-${d}` === `${m[1]}-${m[2]}-${m[3]}` && h === String(hour).padStart(2, "0") && mi === t[2]) {
      return candidate.toISOString();
    }
  }
  return asUtc.toISOString();
}

function daypartBounds(
  daypart: string,
): { startHour: number; endHour: number } | null {
  const d = daypart.toUpperCase();
  if (d === "MORNING") return { startHour: 8, endHour: 12 };
  if (d === "AFTERNOON") return { startHour: 12, endHour: 17 };
  if (d === "EVENING") return { startHour: 17, endHour: 20 };
  return null;
}

export function schedulingLocalSemanticsToUtcWindow(input: {
  specialist: SchedulingSpecialistResult;
  timeZone: string;
  referenceUtcIso: string;
}): { windowStartUtc: string; windowEndUtc: string; specificTimeUtc: string | null } | null {
  const s = input.specialist;
  const date = s.requested_local_date?.trim();
  if (!date) return null;

  if (s.requested_local_time) {
    const at = localWallTimeToUtcIso(date, s.requested_local_time, input.timeZone);
    if (!at) return null;
    const rel = (s.time_relation || "AT").toUpperCase();
    const t = new Date(at).getTime();
    if (rel === "AFTER") {
      return {
        windowStartUtc: at,
        windowEndUtc: new Date(t + 8 * 3600_000).toISOString(),
        specificTimeUtc: null,
      };
    }
    if (rel === "BEFORE") {
      return {
        windowStartUtc: new Date(t - 8 * 3600_000).toISOString(),
        windowEndUtc: at,
        specificTimeUtc: null,
      };
    }
    return {
      windowStartUtc: new Date(t - 3600_000).toISOString(),
      windowEndUtc: new Date(t + 3600_000).toISOString(),
      specificTimeUtc: at,
    };
  }

  if (s.daypart) {
    const bounds = daypartBounds(s.daypart);
    if (!bounds) return null;
    const start = localWallTimeToUtcIso(date, `${bounds.startHour}:00`, input.timeZone);
    const end = localWallTimeToUtcIso(date, `${bounds.endHour}:00`, input.timeZone);
    if (!start || !end) return null;
    return { windowStartUtc: start, windowEndUtc: end, specificTimeUtc: null };
  }

  const dayStart = localWallTimeToUtcIso(date, "8:00", input.timeZone);
  const dayEnd = localWallTimeToUtcIso(date, "20:00", input.timeZone);
  if (!dayStart || !dayEnd) return null;
  return { windowStartUtc: dayStart, windowEndUtc: dayEnd, specificTimeUtc: null };
}
