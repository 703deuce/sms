export type ClassScheduleInput = {
  startDate: string;
  startTime: string;
  durationMinutes: number;
  weekdays: number[];
  maxOccurrences: number;
  isWorkshop: boolean;
};

function parseLocalDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function buildOccurrencePayloads(schedule: ClassScheduleInput): Array<{
  startsAt: string;
  endsAt: string;
}> {
  const start = parseLocalDateTime(schedule.startDate, schedule.startTime);
  if (schedule.isWorkshop) {
    const end = addMinutes(start, schedule.durationMinutes);
    return [{ startsAt: start.toISOString(), endsAt: end.toISOString() }];
  }

  const results: Array<{ startsAt: string; endsAt: string }> = [];
  const weekdays = schedule.weekdays.length ? schedule.weekdays : [start.getDay()];
  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const horizon = addDays(cursor, 84);

  while (cursor <= horizon && results.length < schedule.maxOccurrences) {
    if (weekdays.includes(cursor.getDay())) {
      const occStart = parseLocalDateTime(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`,
        schedule.startTime,
      );
      if (occStart.getTime() >= Date.now() - 86_400_000) {
        const occEnd = addMinutes(occStart, schedule.durationMinutes);
        results.push({ startsAt: occStart.toISOString(), endsAt: occEnd.toISOString() });
      }
    }
    cursor = addDays(cursor, 1);
  }
  return results;
}

export function previewOccurrenceDates(schedule: ClassScheduleInput, limit = 5): string[] {
  return buildOccurrencePayloads(schedule)
    .slice(0, limit)
    .map((o) => {
      const d = new Date(o.startsAt);
      return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    });
}
