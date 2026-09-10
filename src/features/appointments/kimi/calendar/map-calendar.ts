import { formatAppointmentTime } from "@/components/appointments/appointment-ui";
import { fallbackTypeDot, fallbackTypeColorKey } from "@/lib/appointments/calendar-colors";
import type {
  CalendarAgendaItem,
  CalendarAvailabilityBand,
  CalendarBusyBlock,
  CalendarMiniDay,
  CalendarMonthDay,
  CalendarNextAppointment,
  CalendarNowLine,
  CalendarPageModel,
  CalendarStaffLane,
  CalendarStatItem,
  CalendarTypeColor,
  CalendarViewMode,
  CalendarWeekDay,
  CalendarWeekEvent,
  AppointmentMeetingIndicator,
  CalendarBookingKind,
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
  staffId?: string | null;
  staffName?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  bookingTypeKind?: CalendarBookingKind | string | null;
  typeId?: string | null;
  capacity?: number | null;
  enrolledCount?: number | null;
  colorDot?: string;
  staffColor?: string;
  isRecurring?: boolean;
  recurringLabel?: string | null;
  recurringOccurrenceIndex?: number | null;
  recurringTotal?: number | null;
};

export type CalendarBusyApiBlock = {
  id: string;
  startsAt: string;
  endsAt: string;
  label?: string;
  source?: string;
  staffId?: string | null;
};

export type CalendarFilterState = {
  staffIds: string[];
  typeIds: string[];
  locationIds: string[];
  statuses: string[];
};

export type BuildCalendarContext = {
  staffLanes?: CalendarStaffLane[];
  busyBlocks?: CalendarBusyApiBlock[];
  showAvailability?: boolean;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
  filters?: CalendarFilterState;
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
  if (view === "day" || view === "staff") {
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

function mapEventType(
  serviceName: string | null,
  status: string,
  kind?: string | null,
): CalendarWeekEvent["type"] {
  if (mapUiStatus(status) === "canceled") return "canceled";
  if (kind === "CLASS") return "onboarding";
  if (kind === "MEETING") return "call";
  const name = (serviceName || "").toLowerCase();
  if (name.includes("onboard")) return "onboarding";
  if (name.includes("follow")) return "followup";
  if (name.includes("call") || name.includes("demo")) return "call";
  return "consultation";
}

function mapBookingKind(kind?: string | null, serviceName?: string | null): CalendarBookingKind {
  if (kind === "MEETING" || kind === "SERVICE" || kind === "CLASS") return kind;
  const name = (serviceName || "").toLowerCase();
  if (name.includes("workshop") || name.includes("event")) return "EVENT";
  if (name.includes("class") || name.includes("yoga")) return "CLASS";
  if (name.includes("meeting") || name.includes("call")) return "MEETING";
  return "SERVICE";
}

function capacityLabel(row: CalendarApiAppointment): string | undefined {
  if (row.capacity == null) return undefined;
  const enrolled = row.enrolledCount ?? 0;
  if (enrolled >= row.capacity) return "Full";
  return `${enrolled} / ${row.capacity}`;
}

function passesFilters(row: CalendarApiAppointment, filters?: CalendarFilterState): boolean {
  if (!filters) return true;
  if (filters.staffIds.length && row.staffId && !filters.staffIds.includes(row.staffId)) return false;
  if (filters.typeIds.length && row.typeId && !filters.typeIds.includes(row.typeId)) return false;
  if (filters.locationIds.length && row.locationId && !filters.locationIds.includes(row.locationId)) {
    return false;
  }
  if (filters.statuses.length) {
    const ui = mapUiStatus(row.status);
    const normalized =
      ui === "canceled"
        ? "canceled"
        : ui === "pending"
          ? "pending"
          : row.status === "completed"
            ? "completed"
            : row.status === "no_show"
              ? "no_show"
              : "confirmed";
    if (!filters.statuses.includes(normalized)) return false;
  }
  return true;
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
  context?: BuildCalendarContext,
): CalendarWeekEvent[] {
  const weekEnd = addDays(weekStart, 7);
  const staffLaneIndex = new Map((context?.staffLanes || []).map((s, i) => [s.id, i]));
  return appointments
    .filter((row) => {
      const start = new Date(row.startsAt);
      return start >= weekStart && start < weekEnd && passesFilters(row, context?.filters);
    })
    .map((row) => {
      const start = new Date(row.startsAt);
      const dayIndex = Math.floor((start.getTime() - weekStart.getTime()) / 86_400_000);
      const startHour = decimalHour(row.startsAt, row.timezone);
      const endHour = row.endsAt
        ? decimalHour(row.endsAt, row.timezone)
        : startHour + 0.5;
      const type = mapEventType(row.serviceName, row.status, row.bookingTypeKind);
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
      const colorDot =
        row.colorDot || fallbackTypeDot(row.bookingTypeKind, row.serviceName);
      return {
        id: row.id,
        day: Math.max(0, Math.min(6, dayIndex)),
        staffLane: row.staffId ? staffLaneIndex.get(row.staffId) : undefined,
        start: startHour,
        duration: Math.max(0.25, endHour - startHour),
        timeLabel: formatAppointmentTime(row.startsAt, row.timezone),
        title,
        name,
        type,
        status: mapUiStatus(row.status),
        meeting: row.meeting,
        eventKind: row.eventKind,
        colorDot,
        bookingKind: mapBookingKind(row.bookingTypeKind, row.serviceName),
        capacityLabel: capacityLabel(row),
        isRecurring: row.isRecurring,
        recurringLabel: row.recurringLabel,
        staffId: row.staffId,
        staffName: row.staffName,
        locationName: row.locationName,
      };
    });
}

function mapBusyBlocks(
  blocks: CalendarBusyApiBlock[],
  weekStart: Date,
  context?: BuildCalendarContext,
): CalendarBusyBlock[] {
  const weekEnd = addDays(weekStart, 7);
  const staffLaneIndex = new Map((context?.staffLanes || []).map((s, i) => [s.id, i]));
  return blocks
    .filter((b) => {
      const start = new Date(b.startsAt);
      return start >= weekStart && start < weekEnd;
    })
    .map((b) => {
      const start = new Date(b.startsAt);
      const dayIndex = Math.floor((start.getTime() - weekStart.getTime()) / 86_400_000);
      const startHour = decimalHour(b.startsAt, null);
      const endHour = decimalHour(b.endsAt, null);
      return {
        id: b.id,
        day: Math.max(0, Math.min(6, dayIndex)),
        staffLane: b.staffId ? staffLaneIndex.get(b.staffId) : undefined,
        start: startHour,
        duration: Math.max(0.25, endHour - startHour),
        label: b.label || "Busy",
        source: b.source || "External calendar",
      };
    });
}

function mapAvailabilityBands(
  weekDays: CalendarWeekDay[],
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>,
  staffLanes?: CalendarStaffLane[],
): CalendarAvailabilityBand[] {
  if (!weeklyHours) return [];
  const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const bands: CalendarAvailabilityBand[] = [];
  weekDays.forEach((d, dayIndex) => {
    const windows = weeklyHours[dayKeys[d.dayOfWeek]] || [];
    for (const w of windows) {
      const [oh, om] = w.open.split(":").map(Number);
      const [ch, cm] = w.close.split(":").map(Number);
      const start = oh + (om || 0) / 60;
      const end = ch + (cm || 0) / 60;
      if (staffLanes?.length) {
        staffLanes.forEach((_, lane) => {
          bands.push({ day: dayIndex, staffLane: lane, start, duration: Math.max(0.25, end - start) });
        });
      } else {
        bands.push({ day: dayIndex, start, duration: Math.max(0.25, end - start) });
      }
    }
  });
  return bands;
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
  context?: BuildCalendarContext;
};

function mapDayEvents(
  appointments: CalendarApiAppointment[],
  dayKey: string,
  context?: BuildCalendarContext,
): CalendarWeekEvent[] {
  const dayStart = new Date(dayKey);
  dayStart.setHours(0, 0, 0, 0);
  const weekStart = dayStart;
  return mapWeekEvents(
    appointments.filter((row) => dateKey(new Date(row.startsAt)) === dayKey),
    weekStart,
    context,
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

function buildDynamicTypeColors(appointments: CalendarApiAppointment[]): Record<string, CalendarTypeColor> {
  const colors: Record<string, CalendarTypeColor> = { ...TYPE_COLORS };
  for (const row of appointments) {
    const key = fallbackTypeColorKey(row.bookingTypeKind, row.serviceName);
    if (!colors[key]) {
      colors[key] = {
        label: row.serviceName || key,
        dot: row.colorDot || fallbackTypeDot(row.bookingTypeKind, row.serviceName),
      };
    }
  }
  return colors;
}

export function buildCalendarPageModel(input: BuildCalendarPageModelInput): CalendarPageModel {
  const ctx = input.context;
  const weekStart =
    input.view === "day" || input.view === "staff"
      ? new Date(input.cursor)
      : input.view === "week"
        ? input.cursor
        : startOfWeek(new Date(input.selectedDayKey));
  const weekDays =
    input.view === "day" || input.view === "staff"
      ? mapWeekDays(weekStart).filter((d) => d.dateKey === dateKey(input.cursor))
      : input.view === "week"
        ? mapWeekDays(weekStart)
        : mapWeekDays(weekStart);
  const weekEvents =
    input.view === "day" || input.view === "staff"
      ? mapDayEvents(input.appointments, dateKey(input.cursor), ctx)
      : mapWeekEvents(input.appointments, weekStart, ctx);
  const monthDays =
    input.view === "month"
      ? mapMonthDays(input.cursor, input.appointments)
      : mapMonthDays(input.miniCalendarMonth, input.appointments);
  const busyBlocks = mapBusyBlocks(ctx?.busyBlocks || [], weekStart, ctx);
  const availabilityBands =
    ctx?.showAvailability
      ? mapAvailabilityBands(
          weekDays.length ? weekDays : mapWeekDays(weekStart).slice(0, 1),
          ctx.weeklyHours,
          ctx.staffLanes,
        )
      : [];

  return {
    view: input.view,
    rangeLabel: formatRangeLabel(input.cursor, input.view),
    stats: mapStats(input.appointments.filter((r) => passesFilters(r, ctx?.filters))),
    weekDays: weekDays.length ? weekDays : mapWeekDays(weekStart).slice(0, 1),
    weekEvents,
    staffLanes: ctx?.staffLanes || [],
    busyBlocks,
    availabilityBands,
    monthDays,
    hours: HOURS,
    typeColors: buildDynamicTypeColors(input.appointments),
    nowLine:
      input.view === "week" || input.view === "day" || input.view === "staff"
        ? mapNowLine(weekDays.length ? weekDays : mapWeekDays(weekStart).slice(0, 1))
        : null,
    miniCalendar: buildMiniCalendar(input.miniCalendarMonth, input.selectedDayKey, input.appointments),
    agenda: mapAgenda(input.appointments, input.selectedDayKey),
    nextAppointment: mapNextAppointment(input.appointments),
    timezoneLabel: timezoneLabel(),
  };
}
