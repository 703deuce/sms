"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarView from "@/components/appointments/kimi-ui/calendar/page";
import MoveAppointmentDialog from "@/components/appointments/kimi-ui/calendar/components/MoveAppointmentDialog";
import "@/components/appointments/kimi-ui/calendar/reference.css";
import {
  addDays,
  buildCalendarPageModel,
  dateKey,
  getCalendarRange,
  startOfWeek,
  type CalendarApiAppointment,
  type CalendarBusyApiBlock,
  type CalendarFilterState,
} from "@/features/appointments/kimi/calendar/map-calendar";
import type { CalendarPageActions, CalendarPageModel, CalendarViewMode } from "@/features/appointments/kimi/calendar/types";
import { resolveStaffCalendarColor } from "@/lib/appointments/calendar-colors";

type CalendarContext = {
  calendarColors: { staffColors?: Record<string, string>; serviceColors?: Record<string, string> };
  staff: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  bookingTypes: Array<{ id: string; name: string; kind: string; calendarColor: string | null }>;
  weeklyHours?: Record<string, Array<{ open: string; close: string }>>;
};

type PendingMove = {
  id: string;
  title: string;
  customerName: string;
  fromStartsAt: string;
  toStartsAt: string;
  staffName?: string | null;
  locationName?: string | null;
  isRecurring?: boolean;
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

function formatMoveLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
  const [busyBlocks, setBusyBlocks] = useState<CalendarBusyApiBlock[]>([]);
  const [context, setContext] = useState<CalendarContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [staffViewIds, setStaffViewIds] = useState<string[]>([]);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveLoading, setMoveLoading] = useState(false);

  const range = useMemo(() => getCalendarRange(cursor, view === "staff" ? "day" : view), [cursor, view]);

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
    Promise.all([
      fetch(`/api/calendar/events?${params}`).then((r) => {
        if (!r.ok) throw new Error("calendar fetch failed");
        return r.json();
      }),
      fetch("/api/calendar/context").then((r) => (r.ok ? r.json() : { data: null })),
      fetch(`/api/calendar/busy-blocks?${params}`).then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/appointments/settings").then((r) => (r.ok ? r.json() : { data: {} })),
    ])
      .then(async ([eventsJson, ctxJson, busyJson, settingsJson]) => {
        const appointments = (eventsJson.data || []) as CalendarApiAppointment[];
        const enriched = await loadMeetingIndicators(appointments);
        setRows(enriched);
        const ctxData = ctxJson.data as CalendarContext | null;
        const settings = settingsJson.data || {};
        setContext({
          calendarColors: ctxData?.calendarColors || {},
          staff: ctxData?.staff || settings.staff || [],
          locations: ctxData?.locations || settings.locations || [],
          bookingTypes: ctxData?.bookingTypes || [],
          weeklyHours: settings.weeklyHours,
        });
        setBusyBlocks((busyJson.data || []) as CalendarBusyApiBlock[]);
        if (!staffViewIds.length && ctxData?.staff?.length) {
          setStaffViewIds(ctxData.staff.slice(0, 4).map((s) => s.id));
        }
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [loadMeetingIndicators, range.from, range.to, staffViewIds.length]);

  useEffect(() => {
    load();
  }, [load]);

  const filters: CalendarFilterState = useMemo(
    () => ({
      staffIds: selectedStaffIds,
      typeIds: selectedTypeIds,
      locationIds: selectedLocationIds,
      statuses: selectedStatuses,
    }),
    [selectedLocationIds, selectedStaffIds, selectedStatuses, selectedTypeIds],
  );

  const filterCount =
    selectedStaffIds.length + selectedTypeIds.length + selectedLocationIds.length + selectedStatuses.length;

  const staffLanes = useMemo(() => {
    const colorConfig = context?.calendarColors;
    const pool = context?.staff || [];
    const ids = view === "staff" ? (staffViewIds.length ? staffViewIds : pool.slice(0, 4).map((s) => s.id)) : [];
    return ids
      .map((id) => pool.find((s) => s.id === id))
      .filter(Boolean)
      .map((s) => ({
        id: s!.id,
        name: s!.name,
        color: resolveStaffCalendarColor(colorConfig, s!.id),
      }));
  }, [context, staffViewIds, view]);

  const model: CalendarPageModel | null = useMemo(
    () =>
      buildCalendarPageModel({
        appointments: rows,
        cursor,
        view,
        selectedDayKey,
        miniCalendarMonth,
        context: {
          filters,
          staffLanes: view === "staff" ? staffLanes : undefined,
          busyBlocks,
          showAvailability,
          weeklyHours: context?.weeklyHours,
        },
      }),
    [busyBlocks, context?.weeklyHours, cursor, filters, miniCalendarMonth, rows, selectedDayKey, showAvailability, staffLanes, view],
  );

  const shift = useCallback(
    (direction: -1 | 1) => {
      setCursor((c) =>
        view === "day" || view === "staff"
          ? addDays(c, direction)
          : view === "week"
            ? addDays(c, direction * 7)
            : new Date(c.getFullYear(), c.getMonth() + direction, 1),
      );
    },
    [view],
  );

  const confirmMove = useCallback(
    async (scope?: "this_only" | "this_and_future" | "entire_series") => {
      if (!pendingMove) return;
      setMoveLoading(true);
      setMoveError(null);
      try {
        const body: Record<string, unknown> = { startsAt: pendingMove.toStartsAt };
        if (scope) body.recurringScope = scope;
        const res = await fetch(`/api/appointments/${pendingMove.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error || "Could not move appointment");
        }
        setPendingMove(null);
        load();
      } catch (err) {
        setMoveError(err instanceof Error ? err.message : "Could not move appointment");
      } finally {
        setMoveLoading(false);
      }
    },
    [load, pendingMove],
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
        if (id.startsWith("busy:")) return;
        router.push(`/appointments/${id}`);
      },
      onSelectDay: (key) => {
        setSelectedDayKey(key);
        const d = new Date(key);
        setMiniCalendarMonth(new Date(d.getFullYear(), d.getMonth(), 1));
        if (view === "day" || view === "staff") setCursor(d);
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
      onSlotClick: ({ dateKey: slotDay, hour, staffId }) => {
        const d = new Date(slotDay);
        d.setHours(hour, 0, 0, 0);
        const params = new URLSearchParams({ startsAt: d.toISOString() });
        if (staffId) params.set("staffId", staffId);
        router.push(`/appointments/new?${params}`);
      },
      onEventMove: ({ id, toStartsAt }) => {
        const row = rows.find((r) => r.id === id);
        if (!row) return;
        setMoveError(null);
        setPendingMove({
          id,
          title: row.serviceName || "Appointment",
          customerName: row.inviteeName || "Customer",
          fromStartsAt: row.startsAt,
          toStartsAt,
          staffName: row.staffName,
          locationName: row.locationName,
          isRecurring: row.isRecurring,
        });
      },
      onToggleFilters: () => setFiltersOpen((v) => !v),
      onToggleAvailability: () => setShowAvailability((v) => !v),
      filterCount,
      showAvailability,
    }),
    [filterCount, load, router, rows, selectedDayKey, shift, showAvailability, view],
  );

  if (loading) return <CalendarLoading />;
  if (failed || !model) return <CalendarError onRetry={load} />;

  const colorConfig = context?.calendarColors;

  return (
    <div>
      <CalendarView
        model={model}
        actions={actions}
        filtersOpen={filtersOpen}
        filterStaff={(context?.staff || []).map((s) => ({
          id: s.id,
          name: s.name,
          color: resolveStaffCalendarColor(colorConfig, s.id),
        }))}
        filterTypes={(context?.bookingTypes || []).map((t) => ({
          id: t.id,
          name: t.name,
          color: t.calendarColor || undefined,
        }))}
        filterLocations={context?.locations || []}
        selectedStaffIds={selectedStaffIds}
        selectedTypeIds={selectedTypeIds}
        selectedLocationIds={selectedLocationIds}
        selectedStatuses={selectedStatuses}
        onToggleStaffFilter={(id) =>
          setSelectedStaffIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onToggleTypeFilter={(id) =>
          setSelectedTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onToggleLocationFilter={(id) =>
          setSelectedLocationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
        onToggleStatusFilter={(status) =>
          setSelectedStatuses((prev) =>
            prev.includes(status) ? prev.filter((x) => x !== status) : [...prev, status],
          )
        }
        onClearFilters={() => {
          setSelectedStaffIds([]);
          setSelectedTypeIds([]);
          setSelectedLocationIds([]);
          setSelectedStatuses([]);
        }}
        onCloseFilters={() => setFiltersOpen(false)}
      />
      <MoveAppointmentDialog
        open={Boolean(pendingMove)}
        title={pendingMove?.title || ""}
        customerName={pendingMove?.customerName || ""}
        fromLabel={pendingMove ? formatMoveLabel(pendingMove.fromStartsAt) : ""}
        toLabel={pendingMove ? formatMoveLabel(pendingMove.toStartsAt) : ""}
        staffName={pendingMove?.staffName}
        locationName={pendingMove?.locationName}
        isRecurring={pendingMove?.isRecurring}
        onClose={() => setPendingMove(null)}
        onConfirm={confirmMove}
        error={moveError}
        loading={moveLoading}
      />
    </div>
  );
}
