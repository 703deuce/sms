import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import type { CalendarViewMode } from "@/features/appointments/kimi/calendar/types";

export const AR_CALENDAR_DAY_START_HOUR = 6;
export const AR_CALENDAR_DAY_END_HOUR = 21;
export const AR_CALENDAR_HOUR_PX = 58;

export function startOfWeek(d: Date) {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function dateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayKeyInTimeZone(isoOrDate: Date | string, timeZone: string) {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function zonedCalendarParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

export function getArCalendarRange(cursor: Date, view: CalendarViewMode) {
  if (view === "agenda") {
    const from = new Date(cursor);
    from.setHours(0, 0, 0, 0);
    const to = addDays(from, 14);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (view === "day") {
    const from = new Date(cursor);
    from.setHours(0, 0, 0, 0);
    const to = new Date(cursor);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (view === "week") {
    const from = startOfWeek(cursor);
    const to = addDays(from, 7);
    to.setMilliseconds(to.getMilliseconds() - 1);
    return { from, to };
  }
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

export function formatArCalendarTitle(cursor: Date, view: CalendarViewMode, timeZone: string) {
  if (view === "day") {
    return cursor.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone,
    });
  }
  if (view === "week") {
    const end = addDays(startOfWeek(cursor), 6);
    const a = startOfWeek(cursor).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone,
    });
    const b = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone,
    });
    return `${a} – ${b}`;
  }
  if (view === "agenda") {
    return cursor.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone });
  }
  return cursor.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone });
}

export function formatArCalendarSubtitle(cursor: Date, view: CalendarViewMode, timeZone: string) {
  if (view === "month") {
    return cursor.toLocaleDateString("en-US", { weekday: "long", timeZone });
  }
  return null;
}

export type ArCalendarMonthCell = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  key: string;
  dayNum: number;
};

export function buildMonthGrid(cursor: Date, timeZone: string): ArCalendarMonthCell[] {
  const { year, month } = zonedCalendarParts(cursor, timeZone);
  const first = new Date(year, month - 1, 1, 12, 0, 0);
  const start = startOfWeek(first);
  const cells: ArCalendarMonthCell[] = [];
  const todayKey = dayKeyInTimeZone(new Date(), timeZone);

  for (let i = 0; i < 42; i++) {
    const date = addDays(start, i);
    const parts = zonedCalendarParts(date, timeZone);
    const key = dayKeyInTimeZone(date, timeZone);
    cells.push({
      date,
      inMonth: parts.month === month && parts.year === year,
      isToday: key === todayKey,
      key,
      dayNum: parts.day,
    });
  }
  return cells;
}

export function groupEventsByDay(events: CalendarApiAppointment[], timeZone: string) {
  const map = new Map<string, CalendarApiAppointment[]>();
  for (const ev of events) {
    const key = dayKeyInTimeZone(ev.startsAt, timeZone);
    const list = map.get(key) || [];
    list.push(ev);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }
  return map;
}

export function eventTitle(ev: CalendarApiAppointment) {
  return ev.serviceName || ev.inviteeName || "Appointment";
}

export function formatEventTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function eventTopPx(startsAt: string, timeZone: string) {
  const d = new Date(startsAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  const fromStart = hour + minute / 60 - AR_CALENDAR_DAY_START_HOUR;
  return Math.max(0, fromStart * AR_CALENDAR_HOUR_PX);
}

export function eventHeightPx(startsAt: string, endsAt: string | null | undefined, timeZone: string) {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 60 * 60 * 1000;
  const hours = Math.max(0.5, (end - start) / (60 * 60 * 1000));
  return Math.min(hours * AR_CALENDAR_HOUR_PX, (AR_CALENDAR_DAY_END_HOUR - AR_CALENDAR_DAY_START_HOUR) * AR_CALENDAR_HOUR_PX);
}

export function hourLabels() {
  const labels: string[] = [];
  for (let h = AR_CALENDAR_DAY_START_HOUR; h <= AR_CALENDAR_DAY_END_HOUR; h++) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    labels.push(
      d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(":00", ""),
    );
  }
  return labels;
}

export function weekDayHeaders(cursor: Date, timeZone: string) {
  const start = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const key = dayKeyInTimeZone(date, timeZone);
    const parts = zonedCalendarParts(date, timeZone);
    return {
      key,
      date,
      weekday: date.toLocaleDateString("en-US", { weekday: "short", timeZone }),
      dayNum: String(parts.day),
      isToday: key === dayKeyInTimeZone(new Date(), timeZone),
    };
  });
}
