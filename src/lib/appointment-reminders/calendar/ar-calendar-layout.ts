import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import type { CalendarViewMode } from "@/features/appointments/kimi/calendar/types";

export const AR_CALENDAR_DAY_START_HOUR = 6;
export const AR_CALENDAR_DAY_END_HOUR = 21;
export const AR_CALENDAR_HOUR_PX = 56;

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

export function looksLikePhoneOnly(value: string) {
  const t = value.trim();
  if (!t) return false;
  const digits = t.replace(/\D/g, "");
  return digits.length >= 7 && /^[\d\s().+\-]+$/.test(t);
}

/** Primary line for calendar blocks — prefer real customer name over phone-like strings. */
export function eventTitle(ev: CalendarApiAppointment) {
  const name = ev.inviteeName?.trim() || "";
  const service = ev.serviceName?.trim() || "";
  const nameOk = Boolean(name) && !looksLikePhoneOnly(name);
  const serviceOk = Boolean(service) && !looksLikePhoneOnly(service);
  if (nameOk) return name;
  if (serviceOk) return service;
  if (name) return name;
  return service || "Appointment";
}

/** Secondary line when both name and service are meaningful. */
export function eventSubtitle(ev: CalendarApiAppointment): string | null {
  const name = ev.inviteeName?.trim() || "";
  const service = ev.serviceName?.trim() || "";
  const nameOk = Boolean(name) && !looksLikePhoneOnly(name);
  const serviceOk = Boolean(service) && !looksLikePhoneOnly(service);
  if (nameOk && serviceOk && service !== name) return service;
  return null;
}

export function formatEventTime(iso: string, timeZone: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export type ArCalendarGrid = {
  startHour: number;
  endHour: number;
  hourPx: number;
};

export function defaultArCalendarGrid(): ArCalendarGrid {
  return {
    startHour: AR_CALENDAR_DAY_START_HOUR,
    endHour: AR_CALENDAR_DAY_END_HOUR,
    hourPx: AR_CALENDAR_HOUR_PX,
  };
}

function eventTimeHours(iso: string, timeZone: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour + minute / 60;
}

export function eventTopPx(startsAt: string, timeZone: string, grid: ArCalendarGrid = defaultArCalendarGrid()) {
  const fromStart = eventTimeHours(startsAt, timeZone) - grid.startHour;
  return Math.max(0, fromStart * grid.hourPx);
}

export function eventHeightPx(
  startsAt: string,
  endsAt: string | null | undefined,
  timeZone: string,
  grid: ArCalendarGrid = defaultArCalendarGrid(),
) {
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 60 * 60 * 1000;
  const hours = Math.max(0.5, (end - start) / (60 * 60 * 1000));
  const maxH = grid.endHour - grid.startHour;
  return Math.min(hours * grid.hourPx, maxH * grid.hourPx);
}

export function hourLabels(grid: ArCalendarGrid = defaultArCalendarGrid()) {
  const labels: string[] = [];
  for (let h = grid.startHour; h <= grid.endHour; h++) {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    labels.push(
      d.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(":00", ""),
    );
  }
  return labels;
}

function eventRangeMs(ev: CalendarApiAppointment) {
  const start = new Date(ev.startsAt).getTime();
  const end = ev.endsAt ? new Date(ev.endsAt).getTime() : start + 60 * 60 * 1000;
  return { start, end };
}

/** Side-by-side columns for overlapping appointments in a day column. */
export function layoutDayEventColumns(events: CalendarApiAppointment[]): Map<string, { col: number; cols: number }> {
  const sorted = [...events].sort((a, b) => eventRangeMs(a).start - eventRangeMs(b).start);
  const result = new Map<string, { col: number; cols: number }>();
  const columns: { end: number }[][] = [];

  for (const ev of sorted) {
    const { start, end } = eventRangeMs(ev);
    let placed = -1;
    for (let c = 0; c < columns.length; c++) {
      const colEvents = columns[c];
      const last = colEvents[colEvents.length - 1];
      if (!last || last.end <= start) {
        placed = c;
        colEvents.push({ end });
        break;
      }
    }
    if (placed < 0) {
      placed = columns.length;
      columns.push([{ end }]);
    }
    result.set(ev.id, { col: placed, cols: 1 });
  }

  for (const ev of sorted) {
    const { start, end } = eventRangeMs(ev);
    const overlapping = sorted.filter((o) => {
      const r = eventRangeMs(o);
      return r.start < end && r.end > start;
    });
    const cols = Math.max(...overlapping.map((o) => result.get(o.id)!.col)) + 1;
    for (const o of overlapping) {
      const prev = result.get(o.id)!;
      result.set(o.id, { col: prev.col, cols });
    }
  }
  return result;
}

export function currentTimeTopPx(timeZone: string, grid: ArCalendarGrid = defaultArCalendarGrid()) {
  const now = new Date();
  const key = dayKeyInTimeZone(now, timeZone);
  const hours = eventTimeHours(now.toISOString(), timeZone);
  if (hours < grid.startHour || hours > grid.endHour) return null;
  return { top: (hours - grid.startHour) * grid.hourPx, dayKey: key };
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
