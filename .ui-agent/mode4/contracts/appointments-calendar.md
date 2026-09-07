PAGE CONTRACT — MODE 4
Canonical page: Appointments → Calendar
Route: /appointments/calendar
Archetype: Calendar
Manifest ID: appointments-calendar
V1 spec: §7 Calendar
Primary job:
Rebuild this approved Transovo production surface with premium visual quality while preserving approved functionality, backend contracts, permissions, and states.
Required features:
- Derive from approved feature inventory + existing implementation (below)
- Every approved capability for this surface must remain represented
- Reposition features per governance/IA when old placement was wrong
- Do NOT reintroduce out-of-scope legacy product features
Required states:
- normal
- loading
- first-use empty
- no-results
- error
- partial/degraded
- permission/read-only
Required backend/data contracts:
- /api/appointments/meeting-indicators
- /api/calendar/events
Detected hooks (preserve wiring):
- useCallback
- useEffect
- useMemo
- useRouter
- useState
Detected actions/handlers (preserve behavior):
- onClick={onRetry}>
File ownership:
Primary files Kimi may modify:
- src/app/(app)/appointments/calendar/page.tsx
- src/components/appointments/calendar-client.tsx
- src/components/appointments/kimi-ui/calendar/page.tsx
- src/components/ui/button.tsx
- src/features/appointments/kimi/calendar/calendar-connected.tsx
- src/features/appointments/kimi/calendar/map-calendar.ts
- src/features/appointments/kimi/calendar/types.ts
Shared files to consume (do not fork):
- src/components/layout/
- src/components/ui/
- src/styles/
Shared files forbidden in this job:
- src/components/layout/sidebar.tsx
- src/components/layout/header.tsx
- src/components/ui/
- src/app/globals.css
- src/app/(app)/product-theme.css
Canonical terminology:
- Appointment, Contact, Booking Type, Booking Page, Reminder Sequence, Workflow, Meeting, Payment
- Use Transovo IA labels — never competitor product names
Relevant standards:
- Governance
- IA & Navigation
- Page Architecture
- Visual Design System
- Accessibility
- Interaction/Keyboard/Focus
- Responsive/Reflow
- Table/Grid Semantics
- Date/Timezone
- Privacy/Consent
- Security/Authentication
EXISTING IMPLEMENTATION CONTEXT (functionality reference — visuals not authoritative):
TARGET ROUTE: /appointments/calendar

IN SCOPE: /appointments/calendar, src/app/(app)/appointments/calendar/page.tsx, src/components/appointments/calendar-client.tsx, src/components/appointments/kimi-ui/calendar/page.tsx, src/components/ui/button.tsx, src/features/appointments/kimi/calendar/calendar-connected.tsx, src/features/appointments/kimi/calendar/map-calendar.ts, src/features/appointments/kimi/calendar/types.ts

OUT OF SCOPE: /campaigns, /contacts, /settings, /dashboard, /voice

TARGET FILES:
- src/app/(app)/appointments/calendar/page.tsx
- src/components/appointments/calendar-client.tsx
- src/components/appointments/kimi-ui/calendar/page.tsx
- src/components/ui/button.tsx
- src/features/appointments/kimi/calendar/calendar-connected.tsx
- src/features/appointments/kimi/calendar/map-calendar.ts
- src/features/appointments/kimi/calendar/types.ts

API CONTRACTS (preserve):
- /api/appointments/meeting-indicators
- /api/calendar/events

DESIGN SYSTEM:
- src/components/ui/button.tsx
- src/components/ui/card.tsx
- src/components/ui/empty-state.tsx
- src/components/ui/input.tsx
- src/components/ui/metric.tsx
- src/components/ui/page-header.tsx
- src/components/ui/status-chip.tsx
- src/components/ui/table.tsx
- src/components/ui/tabs.tsx


--- FILE: src/app/(app)/appointments/calendar/page.tsx ---
import { AppointmentsCalendarClient } from "@/components/appointments/calendar-client";

export default function AppointmentsCalendarPage() {
  return <AppointmentsCalendarClient />;
}



--- FILE: src/components/appointments/calendar-client.tsx ---
"use client";

export { CalendarConnected, CalendarConnected as AppointmentsCalendarClient } from "@/features/appointments/kimi/calendar/calendar-connected";



--- FILE: src/components/appointments/kimi-ui/calendar/page.tsx ---
"use client";

import React from "react";
import "./reference.css";
import CalendarHeader from "./components/CalendarHeader";
import StatCards from "./components/StatCards";
import WeekCalendar from "./components/WeekCalendar";
import DayCalendar from "./components/DayCalendar";
import MonthCalendar from "./components/MonthCalendar";
import MiniCalendar from "./components/MiniCalendar";
import DayAgenda from "./components/DayAgenda";
import NextAppointment from "./components/NextAppointment";
import type { CalendarPageActions, CalendarPageModel } from "@/features/appointments/kimi/calendar/types";

type Props = {
  model: CalendarPageModel;
  actions: CalendarPageActions;
};

export default function CalendarPage({ model, actions }: Props) {
  return (
    <div className="cal-page">
      <CalendarHeader
        rangeLabel={model.rangeLabel}
        view={model.view}
        onToday={actions.onToday}
        onPrev={actions.onPrev}
        onNext={actions.onNext}
        onViewChange={actions.onViewChange}
        onNewAppointment={actions.onNewAppointment}
      />
      <StatCards stats={model.stats} />
      <div className="cal-main">
        {model.view === "day" ? (
          <DayCalendar
            weekDays={model.weekDays}
            weekEvents={model.weekEvents}
            hours={model.hours}
            typeColors={model.typeColors}
            nowLine={model.nowLine}
            timezoneLabel={model.timezoneLabel}
            onOpenAppointment={actions.onOpenAppointment}
            onShowCalendarSettings={actions.onShowCalendarSettings}
          />
        ) : model.view === "month" ? (
          <MonthCalendar
            monthDays={model.monthDays}
            typeColors={model.typeColors}
            onOpenAppointment={actions.onOpenAppointment}
            onSelectDay={actions.onSelectDay}
            onShowCalendarSettings={actions.onShowCalendarSettings}
          />
        ) : (
          <WeekCalendar
            weekDays={model.weekDays}
            weekEvents={model.weekEvents}
            hours={model.hours}
            typeColors={model.typeColors}
            nowLine={model.nowLine}
            timezoneLabel={model.timezoneLabel}
            onOpenAppointment={actions.onOpenAppointment}
            onShowCalendarSettings={actions.onShowCalendarSettings}
          />
        )}
        <aside className="cal-side">
          <MiniCalendar
            monthLabel={model.miniCalendar.monthLabel}
            days={model.miniCalendar.days}
            onPrev={actions.onMiniCalendarPrev}
            onNext={actions.onMiniCalendarNext}
            onSelectDay={actions.onSelectDay}
          />
          <DayAgenda
            dateLabel={model.agenda.dateLabel}
            count={model.agenda.count}
            items={model.agenda.items}
            onOpenAppointment={actions.onOpenAppointment}
            onViewFullDay={actions.onViewFullDay}
          />
          {model.nextAppointment ? (
            <NextAppointment
              appointment={model.nextAppointment}
              onOpenAppointment={actions.onOpenAppointment}
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}



--- FILE: src/components/ui/button.tsx ---
import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover active:shadow-none",
  secondary:
    "bg-muted text-foreground hover:bg-border/70",
  ghost: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
  danger: "bg-danger text-danger-foreground shadow-sm hover:opacity-90",
  outline:
    "border border-border bg-card text-foreground shadow-sm hover:bg-muted/60 hover:border-border",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
  icon: "h-9 w-9",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";



--- FILE: src/features/appointments/kimi/calendar/calendar-connected.tsx ---
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarView from "@/components/appointments/kimi-ui/calendar/page";
import "@/components/appointments/kimi-ui/calendar/reference.css";
import {
  addDays,
  buildCalendarPageModel,
  dateKey,
  getCalendarRange,
  startOfWeek,
  type CalendarApiAppointment,
} from "@/features/appointments/kimi/calendar/map-calendar";
import type { CalendarPageActions, CalendarPageModel, CalendarViewMode } from "@/features/appointments/kimi/calendar/types";

function CalendarLoading() {
  return (
    <div className="cal-page animate-pulse">
      <div className="h-10 w-64 rounded bg-gray-200 mb-4" />
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="stat-card h-20" />
        ))}
      </div>
      <div className="cal-main">
        <div className="week-card h-[640px]" />
        <div className="cal-side">
          <div className="card h-56" />
          <div className="card h-72" />
          <div className="card h-64" />
        </div>
      </div>
    </div>
  );
}

function CalendarError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="cal-page flex items-center justify-center min-h-screen">
      <div className="max-w-md text-center rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12">
        <div className="mb-3.5 mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">We couldn&apos;t load your calendar</h3>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Something went wrong while fetching appointments for this range.
        </p>
        <Button size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

export function CalendarConnected() {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<CalendarViewMode>("week");
  const [selectedDayKey, setSelectedDayKey] = useState(() => dateKey(new Date()));
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [rows, setRows] = useState<CalendarApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const range = useMemo(() => getCalendarRange(cursor, view), [cursor, view]);

  const loadMeetingIndicators = useCallback(async (appointments: CalendarApiAppointment[]) => {
    const ids = appointments
      .filter((row) => !row.eventKind || row.eventKind === "appointment")
      .map((row) => row.id);
    if (!ids.length) return appointments;
    const params = new URLSearchParams({ ids: ids.join(",") });
    const res = await fetch(`/api/appointments/meeting-indicators?${params}`);
    if (!res.ok) return appointments;
    const json = await res.json();
    const indicators = (json.data || {}) as Record<string, CalendarApiAppointment["meeting"]>;
    return appointments.map((row) => ({
      ...row,
      meeting:
        row.eventKind && row.eventKind !== "appointment"
          ? row.meeting
          : indicators[row.id] || row.meeting,
    }));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    fetch(`/api/calendar/events?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("calendar fetch failed");
        return r.json();
      })
      .then(async (json) => {
        const appointments = (json.data || []) as CalendarApiAppointment[];
        const enriched = await loadMeetingIndicators(appointments);
        setRows(enriched);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [loadMeetingIndicators, range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const model: CalendarPageModel | null = useMemo(
    () =>
      buildCalendarPageModel({
        appointments: rows,
        cursor,
        view,
        selectedDayKey,
        miniCalendarMonth,
      }),
    [cursor, miniCalendarMonth, rows, selectedDayKey, view],
  );

  const shift = useCallback(
    (direction: -1 | 1) => {
      setCursor((c) =>
        view === "day"
          ? addDays(c, direction)
          : view === "week"
            ? addDays(c, direction * 7)
            : new Date(c.getFullYear(), c.getMonth() + direction, 1),
      );
    },
    [view],
  );

  const actions: CalendarPageActions = useMemo(
    () => ({
      onToday: () => {
        const today = new Date();
        setCursor(view === "week" ? startOfWeek(today) : today);
        setSelectedDayKey(dateKey(today));
        setMiniCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      },
      onPrev: () => shift(-1),
      onNext: () => shift(1),
      onViewChange: (nextView) => {
        setView(nextView);
        if (nextView === "week") {
          setCursor(startOfWeek(new Date(selectedDayKey)));
        } else if (nextView === "month") {
          const selected = new Date(selectedDayKey);
          setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
        } else {
          setCursor(new Date(selectedDayKey));
        }
      },
      onNewAppointment: () => router.push("/appointments/new"),
      onOpenAppointment: (id) => {
        if (id.startsWith("video:")) {
          router.push(`/video/rooms/${id.slice("video:".length)}/host`);
          return;
        }
        if (id.startsWith("meet
/* ... truncated ... */


--- FILE: src/features/appointments/kimi/calendar/map-calendar.ts ---
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
      d
/* ... truncated ... */


--- FILE: src/features/appointments/kimi/calendar/types.ts ---
export type CalendarViewMode = "day" | "week" | "month";

export type CalendarStatItem = {
  icon: "calendar" | "check" | "clock" | "x" | "users";
  tone: "indigo" | "green" | "amber" | "red" | "violet";
  value: string;
  label: string;
  delta?: string;
  deltaUp?: boolean;
};

export type CalendarWeekDay = {
  label: string;
  date: string;
  dateKey: string;
  today: boolean;
  dayOfWeek: number;
};

export type AppointmentMeetingIndicator = {
  notetakerStatus?: string | null;
  notetakerSessionId?: string | null;
  notetakerEnabled?: boolean;
  videoStatus?: string | null;
  videoProvisioningStatus?: string | null;
  videoMeetingId?: string | null;
  videoJoinUrl?: string | null;
  recapReady?: boolean;
  recapSessionId?: string | null;
};

export type CalendarWeekEvent = {
  id: string;
  day: number;
  start: number;
  duration: number;
  timeLabel: string;
  title: string;
  name: string;
  type: "consultation" | "call" | "followup" | "onboarding" | "canceled";
  status: "confirmed" | "pending" | "canceled";
  meeting?: AppointmentMeetingIndicator;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker";
};

export type CalendarTypeColor = {
  label: string;
  dot: string;
};

export type CalendarMiniDay = {
  day: number;
  muted: boolean;
  selected: boolean;
  hasEvent: boolean;
  dateKey: string;
};

export type CalendarAgendaItem = {
  id: string;
  time: string;
  duration: string;
  title: string;
  name: string;
  status: "confirmed" | "pending" | "canceled";
  dot: string;
  meeting?: AppointmentMeetingIndicator;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker";
};

export type CalendarNextAppointment = {
  id: string;
  inLabel: string;
  time: string;
  duration: string;
  title: string;
  name: string;
  method: string;
  phone: string;
  status: "confirmed" | "pending" | "canceled";
  meeting?: AppointmentMeetingIndicator;
  eventKind?: "appointment" | "standalone_video" | "standalone_notetaker";
};

export type CalendarNowLine = {
  top: number;
  label: string;
};

export type CalendarMonthDay = {
  day: number;
  dateKey: string;
  muted: boolean;
  today: boolean;
  events: Array<{
    id: string;
    timeLabel: string;
    title: string;
    name: string;
    type: CalendarWeekEvent["type"];
    status: CalendarWeekEvent["status"];
  }>;
};

export type CalendarPageModel = {
  view: CalendarViewMode;
  rangeLabel: string;
  stats: CalendarStatItem[];
  weekDays: CalendarWeekDay[];
  weekEvents: CalendarWeekEvent[];
  monthDays: CalendarMonthDay[];
  hours: string[];
  typeColors: Record<string, CalendarTypeColor>;
  nowLine: CalendarNowLine | null;
  miniCalendar: {
    monthLabel: string;
    days: CalendarMiniDay[];
  };
  agenda: {
    dateLabel: string;
    count: number;
    items: CalendarAgendaItem[];
  };
  nextAppointment: CalendarNextAppointment | null;
  timezoneLabel: string;
};

export type CalendarPageActions = {
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onViewChange: (view: CalendarViewMode) => void;
  onNewAppointment: () => void;
  onOpenAppointment: (id: string) => void;
  onSelectDay: (dateKey: string) => void;
  onMiniCalendarPrev: () => void;
  onMiniCalendarNext: () => void;
  onViewFullDay: () => void;
  onShowCalendarSettings: () => void;
  onRetry: () => void;
};
