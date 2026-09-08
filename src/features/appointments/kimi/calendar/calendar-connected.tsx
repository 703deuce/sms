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
        if (id.startsWith("meeting:")) {
          router.push(`/meetings/${id.slice("meeting:".length)}`);
          return;
        }
        router.push(`/appointments/${id}`);
      },
      onSelectDay: (key) => {
        setSelectedDayKey(key);
        const d = new Date(key);
        setMiniCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        if (view === "day") setCursor(d);
      },
      onMiniCalendarPrev: () => {
        setMiniCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
      },
      onMiniCalendarNext: () => {
        setMiniCalendarMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
      },
      onViewFullDay: () => {
        setView("day");
        setCursor(new Date(selectedDayKey));
      },
      onShowCalendarSettings: () => router.push("/appointments/availability"),
      onRetry: load,
      onSlotClick: ({ dateKey, hour }) => {
        const d = new Date(dateKey);
        d.setHours(hour, 0, 0, 0);
        router.push(`/appointments/new?startsAt=${encodeURIComponent(d.toISOString())}`);
      },
    }),
    [load, router, selectedDayKey, shift, view],
  );

  if (loading) return <CalendarLoading />;
  if (failed || !model) return <CalendarError onRetry={load} />;

  return <CalendarView model={model} actions={actions} />;
}
