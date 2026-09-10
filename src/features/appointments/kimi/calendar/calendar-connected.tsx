"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarView from "@/components/appointments/kimi-ui/calendar/page";
import CalendarFiltersDrawer from "@/components/appointments/kimi-ui/calendar/components/CalendarFiltersDrawer";
import "@/components/appointments/kimi-ui/calendar/reference.css";
import {
  addDays,
  applyCalendarFilters,
  buildCalendarPageModel,
  buildWeeklyUnavailableBlocks,
  dateKey,
  getCalendarRange,
  startOfWeek,
  type CalendarApiAppointment,
  type CalendarColorSource,
  type CalendarFilters,
} from "@/features/appointments/kimi/calendar/map-calendar";
import type { CalendarPageActions, CalendarPageModel, CalendarViewMode } from "@/features/appointments/kimi/calendar/types";

const EMPTY_FILTERS: CalendarFilters = {
  staff: [],
  services: [],
  locations: [],
  statuses: [],
};

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

function parseDateKey(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function CalendarConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deepLinkDate = parseDateKey(searchParams.get("date"));
  const [cursor, setCursor] = useState(() => startOfWeek(deepLinkDate ?? new Date()));
  const [view, setView] = useState<CalendarViewMode>("week");
  const [selectedDayKey, setSelectedDayKey] = useState(() => dateKey(deepLinkDate ?? new Date()));
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [rows, setRows] = useState<CalendarApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [colorSource, setColorSource] = useState<CalendarColorSource | null>(null);
  const [weeklyHours, setWeeklyHours] = useState<
    Record<string, Array<{ open: string; close: string }>> | undefined
  >();
  const [toast, setToast] = useState<string | null>(null);

  const range = useMemo(() => getCalendarRange(cursor, view), [cursor, view]);

  useEffect(() => {
    const linked = parseDateKey(searchParams.get("date"));
    if (!linked) return;
    const key = dateKey(linked);
    setSelectedDayKey(key);
    setCursor(startOfWeek(linked));
    setMiniCalendarMonth(new Date(linked.getFullYear(), linked.getMonth(), 1));
  }, [searchParams]);

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

  const loadSettings = useCallback(() => {
    fetch("/api/appointments/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data) return;
        const config = json.data;
        const staffColors: Record<string, string> = {
          ...(config.calendarColors?.staffColors || {}),
        };
        for (const member of config.staff || []) {
          if (member.calendarColor) {
            staffColors[member.id] = member.calendarColor;
            staffColors[member.name] = member.calendarColor;
          }
        }
        const serviceColors: Record<string, string> = {
          ...(config.calendarColors?.serviceColors || {}),
        };
        setColorSource({
          colorBy: config.calendarColorBy === "staff" ? "staff" : "service",
          staffColors,
          serviceColors,
          defaultStaffColor: config.calendarColors?.defaultStaffColor || "#93c5fd",
          defaultServiceColor: config.calendarColors?.defaultServiceColor || "#a78bfa",
        });
        setWeeklyHours(config.weeklyHours);
      })
      .catch(() => {});
    fetch("/api/appointments/types")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const types = json?.data || [];
        setColorSource((prev) => {
          const base = prev || {
            colorBy: "service" as const,
            staffColors: {},
            serviceColors: {},
            defaultStaffColor: "#93c5fd",
            defaultServiceColor: "#a78bfa",
          };
          const serviceColors = { ...base.serviceColors };
          for (const t of types) {
            const color = t.config?.calendarColor || t.config?.color;
            if (color && t.name) serviceColors[t.name] = color;
          }
          return { ...base, serviceColors };
        });
      })
      .catch(() => {});
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
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(
    () => applyCalendarFilters(rows, filters),
    [filters, rows],
  );

  const filterOptions = useMemo(() => {
    const staff = new Set<string>();
    const services = new Set<string>();
    const locations = new Set<string>();
    for (const row of rows) {
      if (row.staffName) staff.add(row.staffName);
      if (row.serviceName) services.add(row.serviceName);
      const loc = row.location || row.metadata?.location;
      if (loc) locations.add(loc);
    }
    const toOptions = (values: Set<string>) =>
      [...values].sort().map((v) => ({ value: v, label: v }));
    return {
      staff: toOptions(staff),
      services: toOptions(services),
      locations: toOptions(locations),
      statuses: [
        { value: "confirmed", label: "Confirmed" },
        { value: "pending", label: "Pending" },
        { value: "canceled", label: "Canceled" },
      ],
    };
  }, [rows]);

  const activeFilterCount =
    filters.staff.length +
    filters.services.length +
    filters.locations.length +
    filters.statuses.length;

  const weekStart =
    view === "day" ? new Date(cursor) : view === "week" ? cursor : startOfWeek(new Date(selectedDayKey));

  const model: CalendarPageModel | null = useMemo(
    () =>
      buildCalendarPageModel({
        appointments: filteredRows,
        cursor,
        view,
        selectedDayKey,
        miniCalendarMonth,
        colorSource: colorSource || undefined,
        showAvailabilityOverlay: showAvailability,
        unavailableBlocks: buildWeeklyUnavailableBlocks(weekStart, weeklyHours),
      }),
    [
      colorSource,
      cursor,
      filteredRows,
      miniCalendarMonth,
      selectedDayKey,
      showAvailability,
      view,
      weekStart,
      weeklyHours,
    ],
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

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const rescheduleEvent = useCallback(
    async (id: string, startsAt: string) => {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        showToast(json.error || "That time isn't available.");
        throw new Error("reschedule failed");
      }
      showToast("Appointment rescheduled.");
      load();
    },
    [load, showToast],
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
      onSlotClick: ({ dateKey: slotKey, hour }) => {
        const d = new Date(slotKey);
        d.setHours(hour, 0, 0, 0);
        router.push(`/appointments/new?startsAt=${encodeURIComponent(d.toISOString())}`);
      },
      onRescheduleEvent: async ({ id, startsAt }) => {
        try {
          await rescheduleEvent(id, startsAt);
        } catch {
          /* toast shown */
        }
      },
      onToggleAvailabilityOverlay: () => setShowAvailability((v) => !v),
      onOpenFilters: () => setFiltersOpen(true),
      activeFilterCount,
    }),
    [
      activeFilterCount,
      load,
      rescheduleEvent,
      router,
      selectedDayKey,
      shift,
      view,
    ],
  );

  if (loading) return <CalendarLoading />;
  if (failed || !model) return <CalendarError onRetry={load} />;

  return (
    <div>
      <div className="cal-page border-b border-gray-200 bg-white px-10 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Recurring appointment series — schedule repeat visits and edit the full series from one place.
          </p>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-50"
            onClick={() => router.push("/appointments/new?recurring=1")}
          >
            New recurring series
          </button>
        </div>
      </div>
      <CalendarView model={model} actions={actions} />
      <CalendarFiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        staffOptions={filterOptions.staff}
        serviceOptions={filterOptions.services}
        locationOptions={filterOptions.locations}
        statusOptions={filterOptions.statuses}
        filters={filters}
        onChange={setFilters}
      />
      {toast ? <div className="cal-toast" role="status">{toast}</div> : null}
    </div>
  );
}
