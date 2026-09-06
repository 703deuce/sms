import { formatAppointmentTime } from "@/components/appointments/appointment-ui";
import type {
  CalendarAgendaItem,
  CalendarMiniDay,
  CalendarNextAppointment,
  CalendarNowLine,
  CalendarPageModel,
  CalendarStatItem,
  CalendarTypeColor,
  CalendarViewMode,
  CalendarWeekDay,
  CalendarWeekEvent,
  AppointmentMeetingIndicator,
} from "./types";

export type CalendarApiAppointment = {
  id: string;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker";
  inviteeName: string | null;
  inviteePhone?: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt?: string | null;
  status: string;
  timezone: string | null;
  metadata?: { location?: string };
  standaloneVideoMeetingId?: string | null;
  standaloneMeetingSessionId?: string | null;
  meeting?: AppointmentMeetingIndicator;
};

const HOUR_H = 56;
const GRID_START = 8;
const HOURS = [
  "8 AM", "9 AM", "10 AM", "11 AM", "12 PM", "1 PM",
  "2 PM", "3 PM", "4 PM", "5 PM", "6 PM",
];

export const TYPE_COLORS: Record<string, CalendarTypeColor> = {
  consultation: { label: "Consultation", dot: "#a78bfa" },
  call: { label: "Call", dot: "#93c5fd" },
  followup: { label: "Follow-up", dot: "#fcd34d" },
  onboarding: { label: "Onboarding", dot: "#6ee7b7" },
  canceled: { label: "Canceled", dot: "#f9a8d4" },
};

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
  return d.toDateString();
}

export function getCalendarRange(cursor: Date, view: CalendarViewMode) {
  if (view === "day") {
    const from = new Date(cursor);
    from.setHours(0, 0, 0, 0);
    const to = new Date(cursor);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  if (view === "week") {
    return { from: cursor, to: addDays(cursor, 7) };
  }
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}

function formatRangeLabel(cursor: Date, view: CalendarViewMode) {
  if (view === "day") {
    return cursor.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "week") {
    const end = addDays(cursor, 6);
    const sameYear = cursor.getFullYear() === end.getFullYear();
    const start = cursor.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(sameYear ? {} : { year: "numeric" }),
    });
    const finish = end.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return `${start} – ${finish}`;
  }
  return cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function mapUiStatus(status: string): "confirmed" | "pending" | "canceled" {
  const key = status.toLowerCase();
  if (key === "confirmed" || key === "completed") return "confirmed";
  if (key === "canceled" || key === "cancelled" || key === "no_show") return "canceled";
  return "pending";
}

function mapEventType(serviceName: string | null, status: string): CalendarWeekEvent["type"] {
  if (mapUiStatus(status) === "canceled") return "canceled";
  const name = (serviceName || "").toLowerCase();
  if (name.includes("onboard")) return "onboarding";
  if (name.includes("follow")) return "followup";
  if (name.includes("call") || name.includes("demo")) return "call";
  return "consultation";
}

function formatDuration(startsAt: string, endsAt?: string | null) {
  if (!endsAt) return "30m";
  const mins = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatDurationLong(startsAt: string, endsAt?: string | null) {
  if (!endsAt) return "30 min";
  const mins = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000);
  return `${mins} min`;
}

function formatTotalDuration(appointments: CalendarApiAppointment[]) {
  const mins = appointments.reduce((sum, row) => {
    if (!row.endsAt) return sum + 30;
    return sum + Math.round((new Date(row.endsAt).getTime() - new Date(row.startsAt).getTime()) / 60000);
  }, 0);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function mapStats(appointments: CalendarApiAppointment[]): CalendarStatItem[] {
  const total = appointments.length;
  const confirmed = appointments.filter((a) => mapUiStatus(a.status) === "confirmed").length;
  const pending = appointments.filter((a) => mapUiStatus(a.status) === "pending").length;
  const canceled = appointments.filter((a) => mapUiStatus(a.status) === "canceled").length;
  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}% of total` : "0% of total");

  return [
    {
      icon: "calendar",
      tone: "indigo",
      value: String(total),
      label: "Appointments",
      delta: total > 0 ? "In selected range" : "No appointments",
      deltaUp: total > 0,
    },
    {
      icon: "check",
      tone: "green",
      value: String(confirmed),
      label: "Confirmed",
      delta: pct(confirmed),
      deltaUp: false,
    },
    {
      icon: "clock",
      tone: "amber",
      value: String(pending),
      label: "Pending",
      delta: pct(pending),
      deltaUp: false,
    },
    {
      icon: "x",
      tone: "red",
      value: String(canceled),
      label: "Canceled",
      delta: pct(canceled),
      deltaUp: false,
    },
    {
      icon: "users",
      tone: "violet",
      value: formatTotalDuration(appointments),
      label: "Total duration",
      delta: total > 0 ? "Scheduled time" : "—",
      deltaUp: false,
    },
  ];
}

function mapWeekDays(cursor: Date): CalendarWeekDay[] {
  const todayKey = dateKey(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(cursor, i);
    return {
      label: day.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase(),
      date: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      dateKey: dateKey(day),
      today: dateKey(day) === todayKey,
      dayOfWeek: i,
    };
  });
}

function decimalHour(iso: string, timezone?: string | null) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || undefined,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return hour + minute / 60;
}

function mapWeekEvents(
  appointments: CalendarApiAppointment[],
  weekStart: Date,
): CalendarWeekEvent[] {
  const weekEnd = addDays(weekStart, 7);
  return appointments
    .filter((row) => {
      const start = new Date(row.startsAt);
      return start >= weekStart && start < weekEnd;
    })
    .map((row) => {
      const start = new Date(row.startsAt);
      const dayIndex = Math.floor((start.getTime() - weekStart.getTime()) / 86_400_000);
      const startHour = decimalHour(row.startsAt, row.timezone);
      const endHour = row.endsAt
        ? decimalHour(row.endsAt, row.timezone)
        : startHour + 0.5;
      const type = mapEventType(row.serviceName, row.status);
      const title =
        row.eventKind === "standalone_video"
          ? row.serviceName || "Transovo Video"
          : row.eventKind === "standalone_notetaker"
            ? row.serviceName || "AI Notetaker"
            : row.serviceName || "Appointment";
      const name =
        row.eventKind === "standalone_video"
          ? "Video meeting"
          : row.eventKind === "standalone_notetaker"
            ? row.inviteeName || "External meeting"
            : row.inviteeName || "Customer";
      return {
        id: row.id,
        day: Math.max(0, Math.min(6, dayIndex)),
        start: startHour,
        duration: Math.max(0.25, endHour - startHour),
        timeLabel: formatAppointmentTime(row.startsAt, row.timezone),
        title,
        name,
        type,
        status: mapUiStatus(row.status),
        meeting: row.meeting,
        eventKind: row.eventKind,
      };
    });
}

function mapNowLine(weekDays: CalendarWeekDay[]): CalendarNowLine | null {
  const today = weekDays.find((d) => d.today);
  if (!today) return null;
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < GRID_START || hour > GRID_START + HOURS.length) return null;
  return {
    top: 57 + (hour - GRID_START) * HOUR_H,
    label: now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
  };
}

function buildMiniCalendar(
  monthCursor: Date,
  selectedDayKey: string,
  appointments: CalendarApiAppointment[],
): { monthLabel: string; days: CalendarMiniDay[] } {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const eventDays = new Set(
    appointments
      .filter((a) => {
        const d = new Date(a.startsAt);
        return d.getFullYear() === year && d.getMonth() === month;
      })
      .map((a) => new Date(a.startsAt).getDate()),
  );

  const cells: CalendarMiniDay[] = [];
  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const d = new Date(year, month - 1, day);
    cells.push({
      day,
      muted: true,
      selected: false,
      hasEvent: false,
      dateKey: dateKey(d),
    });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    cells.push({
      day,
      muted: false,
      selected: dateKey(d) === selectedDayKey,
      hasEvent: eventDays.has(day),
      dateKey: dateKey(d),
    });
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    const d = new Date(year, month + 1, day);
    cells.push({
      day,
      muted: true,
      selected: false,
      hasEvent: false,
      dateKey: dateKey(d),
    });
  }

  return {
    monthLabel: monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    days: cells,
  };
}

function mapAgenda(
  appointments: CalendarApiAppointment[],
  selectedDayKey: string,
): { dateLabel: string; count: number; items: CalendarAgendaItem[] } {
  const selected = new Date(selectedDayKey);
  const items = appointments
    .filter((row) => dateKey(new Date(row.startsAt)) === selectedDayKey)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((row) => {
      const type = mapEventType(row.serviceName, row.status);
      const title =
        row.eventKind === "standalone_video"
          ? row.serviceName || "Transovo Video"
          : row.eventKind === "standalone_notetaker"
            ? row.serviceName || "AI Notetaker"
            : row.serviceName || "Appointment";
      const name =
        row.eventKind === "standalone_video"
          ? "Video meeting"
          : row.eventKind === "standalone_notetaker"
            ? row.inviteeName || "External meeting"
            : row.inviteeName || "Customer";
      return {
        id: row.id,
        time: formatAppointmentTime(row.startsAt, row.timezone),
        duration: formatDuration(row.startsAt, row.endsAt),
        title,
        name,
        status: mapUiStatus(row.status),
        dot: TYPE_COLORS[type]?.dot || TYPE_COLORS.consultation.dot,
        meeting: row.meeting,
        eventKind: row.eventKind,
      };
    });

  return {
    dateLabel: selected.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    count: items.length,
    items,
  };
}

function formatRelativeUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "now";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `in ${hours}h ${rem}m` : `in ${hours}h`;
}

function mapNextAppointment(appointments: CalendarApiAppointment[]): CalendarNextAppointment | null {
  const now = Date.now();
  const upcoming = appointments
    .filter((row) => {
      const start = new Date(row.startsAt).getTime();
      return start > now && mapUiStatus(row.status) !== "canceled";
    })
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];

  if (!upcoming) return null;

  const endLabel = upcoming.endsAt
    ? formatAppointmentTime(upcoming.endsAt, upcoming.timezone)
    : null;

  return {
    id: upcoming.id,
    inLabel: formatRelativeUntil(upcoming.startsAt),
    time: endLabel
      ? `${formatAppointmentTime(upcoming.startsAt, upcoming.timezone)} – ${endLabel}`
      : formatAppointmentTime(upcoming.startsAt, upcoming.timezone),
    duration: formatDurationLong(upcoming.startsAt, upcoming.endsAt),
    title:
      upcoming.eventKind === "standalone_video"
        ? upcoming.serviceName || "Transovo Video"
        : upcoming.eventKind === "standalone_notetaker"
          ? upcoming.serviceName || "AI Notetaker"
          : upcoming.serviceName || "Appointment",
    name:
      upcoming.eventKind === "standalone_video"
        ? "Video meeting"
        : upcoming.eventKind === "standalone_notetaker"
          ? upcoming.inviteeName || "External meeting"
          : upcoming.inviteeName || "Customer",
    method: upcoming.metadata?.location || (upcoming.eventKind ? "Meeting" : "Phone Call"),
    phone: upcoming.inviteePhone || "—",
    status: mapUiStatus(upcoming.status),
    meeting: upcoming.meeting,
    eventKind: upcoming.eventKind,
  };
}

function timezoneLabel() {
  try {
    const offset = -new Date().getTimezoneOffset() / 60;
    const sign = offset >= 0 ? "+" : "";
    return `GMT${sign}${offset}`;
  } catch {
    return "GMT";
  }
}

export type BuildCalendarPageModelInput = {
  appointments: CalendarApiAppointment[];
  cursor: Date;
  view: CalendarViewMode;
  selectedDayKey: string;
  miniCalendarMonth: Date;
};

function mapDayEvents(
  appointments: CalendarApiAppointment[],
  dayKey: string,
): CalendarWeekEvent[] {
  const dayStart = new Date(dayKey);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = dayStart;
  return mapWeekEvents(
    appointments.filter((row) => dateKey(new Date(row.startsAt)) === dayKey),
    weekStart,
  ).map((ev) => ({ ...ev, day: 0 }));
}

function mapMonthDays(
  monthCursor: Date,
  appointments: CalendarApiAppointment[],
): CalendarMonthDay[] {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = dateKey(new Date());
  const cells: CalendarMonthDay[] = [];
  const prevMonthDays = new Date(year, month, 0).getDate();

  for (let i = startPad - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const d = new Date(year, month - 1, day);
    cells.push({
      day,
      dateKey: dateKey(d),
      muted: true,
      today: false,
      events: [],
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKey(d);
    const dayEvents = appointments
      .filter((row) => dateKey(new Date(row.startsAt)) === key)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      .map((row) => {
        const type = mapEventType(row.serviceName, row.status);
        const title =
          row.eventKind === "standalone_video"
            ? row.serviceName || "Transovo Video"
            : row.eventKind === "standalone_notetaker"
              ? row.serviceName || "AI Notetaker"
              : row.serviceName || "Appointment";
        const name =
          row.eventKind === "standalone_video"
            ? "Video meeting"
            : row.eventKind === "standalone_notetaker"
              ? row.inviteeName || "External meeting"
              : row.inviteeName || "Customer";
        return {
          id: row.id,
          timeLabel: formatAppointmentTime(row.startsAt, row.timezone),
          title,
          name,
          type,
          status: mapUiStatus(row.status),
        };
      });
    cells.push({
      day,
      dateKey: key,
      muted: false,
      today: key === todayKey,
      events: dayEvents,
    });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    const d = new Date(year, month + 1, day);
    cells.push({
      day,
      dateKey: dateKey(d),
      muted: true,
      today: false,
      events: [],
    });
  }

  return cells;
}

export function buildCalendarPageModel(input: BuildCalendarPageModelInput): CalendarPageModel {
  const weekStart =
    input.view === "day"
      ? new Date(input.cursor)
      : input.view === "week"
        ? input.cursor
        : startOfWeek(new Date(input.selectedDayKey));
  const weekDays =
    input.view === "day"
      ? mapWeekDays(weekStart).filter((d) => d.dateKey === dateKey(input.cursor))
      : input.view === "week"
        ? mapWeekDays(weekStart)
        : mapWeekDays(weekStart);
  const weekEvents =
    input.view === "day"
      ? mapDayEvents(input.appointments, dateKey(input.cursor))
      : mapWeekEvents(input.appointments, weekStart);
  const monthDays =
    input.view === "month"
      ? mapMonthDays(input.cursor, input.appointments)
      : mapMonthDays(input.miniCalendarMonth, input.appointments);

  return {
    view: input.view,
    rangeLabel: formatRangeLabel(input.cursor, input.view),
    stats: mapStats(input.appointments),
    weekDays: weekDays.length ? weekDays : mapWeekDays(weekStart).slice(0, 1),
    weekEvents,
    monthDays,
    hours: HOURS,
    typeColors: TYPE_COLORS,
    nowLine:
      input.view === "week" || input.view === "day" ? mapNowLine(weekDays.length ? weekDays : mapWeekDays(weekStart).slice(0, 1)) : null,
    miniCalendar: buildMiniCalendar(input.miniCalendarMonth, input.selectedDayKey, input.appointments),
    agenda: mapAgenda(input.appointments, input.selectedDayKey),
    nextAppointment: mapNextAppointment(input.appointments),
    timezoneLabel: timezoneLabel(),
  };
}
