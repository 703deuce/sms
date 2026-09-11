"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import CalendarView from "@/components/appointments/kimi-ui/calendar/page";
import CalendarHeader from "@/components/appointments/kimi-ui/calendar/components/CalendarHeader";
import "@/components/appointments/kimi-ui/calendar/reference.css";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import {
  addDays,
  buildCalendarPageModel,
  dateKey,
  getCalendarRange,
  startOfWeek,
  type CalendarApiAppointment,
} from "@/features/appointments/kimi/calendar/map-calendar";
import type { CalendarPageActions, CalendarPageModel, CalendarViewMode } from "@/features/appointments/kimi/calendar/types";
import { CalendarFilterBar, type CalendarFilters } from "@/components/appointments/calendar/calendar-filter-bar";
import { CalendarEventDrawer } from "@/components/appointments/calendar/calendar-event-drawer";
import { AgendaListView } from "@/components/appointments/calendar/agenda-list-view";

const VIEW_KEY = "tv-calendar-view";
const FILTER_KEY = "tv-calendar-filters";

function loadView(): CalendarViewMode {
  if (typeof window === "undefined") return "week";
  const v = localStorage.getItem(VIEW_KEY);
  if (v === "day" || v === "week" || v === "month" || v === "agenda") return v;
  return "week";
}

function loadFilters(): CalendarFilters {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) return JSON.parse(raw) as CalendarFilters;
  } catch {
    /* ignore */
  }
  return { q: "", staffIds: [], locationId: "", resourceId: "", status: "all", domainType: "all" };
}

function CalendarLoadingShell() {
  return (
    <div className="cal-page appt-overview-pilot animate-pulse min-h-[70vh]">
      <div className="h-12 rounded bg-[var(--surface)] mb-3" />
      <div className="h-[520px] rounded bg-[var(--surface)]" />
    </div>
  );
}

function CalendarError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="cal-page flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-[var(--accent)]" />
        <h3 className="text-sm font-semibold">Couldn&apos;t load calendar</h3>
        <Button size="sm" className="mt-4" onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}

export function CalendarConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [cursor, setCursor] = useState(() => startOfWeek(new Date()));
  const [view, setView] = useState<CalendarViewMode>(() => loadView());
  const [selectedDayKey, setSelectedDayKey] = useState(() => dateKey(new Date()));
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [rows, setRows] = useState<CalendarApiAppointment[]>([]);
  const [rowById, setRowById] = useState<Map<string, CalendarApiAppointment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(() => loadFilters());
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [workspace, setWorkspace] = useState<{
    staff: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
    resources: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
  } | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const range = useMemo(() => getCalendarRange(cursor, view), [cursor, view]);

  useEffect(() => {
    fetch("/api/appointments/calendar/workspace")
      .then((r) => r.json())
      .then((json) => setWorkspace(json.data || null))
      .catch(() => setWorkspace(null));
  }, []);

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify(filters));
  }, [filters]);

  const loadMeetingIndicators = useCallback(async (appointments: CalendarApiAppointment[]) => {
    const ids = appointments
      .filter((row) => row.eventKind === "appointment" || !row.eventKind)
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
    setRefreshing(true);
    if (!rows.length) setLoading(true);
    setFailed(false);
    const params = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    });
    if (filters.q) params.set("q", filters.q);
    if (filters.staffIds.length) params.set("staffIds", filters.staffIds.join(","));
    if (filters.locationId) params.set("locationId", filters.locationId);
    if (filters.resourceId) params.set("resourceId", filters.resourceId);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.domainType !== "all") params.set("domainType", filters.domainType);

    fetch(`/api/calendar/events?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("calendar fetch failed");
        return r.json();
      })
      .then(async (json) => {
        const appointments = (json.data || []) as CalendarApiAppointment[];
        const enriched = await loadMeetingIndicators(appointments);
        setRows(enriched);
        setRowById(new Map(enriched.map((r) => [r.id, r])));
      })
      .catch(() => setFailed(true))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [filters, loadMeetingIndicators, range.from, range.to, rows.length]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const apptId = searchParams.get("appointmentId");
    if (apptId) setDrawerId(apptId);
    const contactId = searchParams.get("contactId");
    if (contactId && !searchParams.get("appointmentId")) {
      router.push(`/appointments/new?contactId=${encodeURIComponent(contactId)}`);
    }
  }, [router, searchParams]);

  const model: CalendarPageModel | null = useMemo(
    () =>
      buildCalendarPageModel({
        appointments: rows,
        cursor,
        view: view === "agenda" ? "week" : view,
        selectedDayKey,
        miniCalendarMonth,
      }),
    [cursor, miniCalendarMonth, rows, selectedDayKey, view],
  );

  const shift = useCallback(
    (direction: -1 | 1) => {
      setCursor((c) => {
        if (view === "agenda") return addDays(c, direction * 14);
        if (view === "day") return addDays(c, direction);
        if (view === "week") return addDays(c, direction * 7);
        return new Date(c.getFullYear(), c.getMonth() + direction, 1);
      });
    },
    [view],
  );

  const openEvent = useCallback((id: string) => {
    setDrawerId(id);
  }, []);

  const actions: CalendarPageActions = useMemo(
    () => ({
      onToday: () => {
        const today = new Date();
        setCursor(view === "week" ? startOfWeek(today) : view === "agenda" ? today : today);
        setSelectedDayKey(dateKey(today));
        setMiniCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      },
      onPrev: () => shift(-1),
      onNext: () => shift(1),
      onViewChange: (nextView) => {
        setView(nextView);
        localStorage.setItem(VIEW_KEY, nextView);
        if (nextView === "week") {
          setCursor(startOfWeek(new Date(selectedDayKey)));
        } else if (nextView === "month") {
          const selected = new Date(selectedDayKey);
          setCursor(new Date(selected.getFullYear(), selected.getMonth(), 1));
        } else if (nextView === "agenda") {
          setCursor(new Date(selectedDayKey));
        } else {
          setCursor(new Date(selectedDayKey));
        }
      },
      onNewAppointment: () => router.push("/appointments/new"),
      onOpenAppointment: openEvent,
      onSelectEvent: openEvent,
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
      onSlotClick: ({ dateKey: dk, hour }) => {
        const d = new Date(dk);
        d.setHours(hour, 0, 0, 0);
        const q = new URLSearchParams({ startsAt: d.toISOString() });
        if (filters.staffIds[0]) q.set("staffId", filters.staffIds[0]);
        if (filters.locationId) q.set("locationId", filters.locationId);
        router.push(`/appointments/new?${q.toString()}`);
      },
    }),
    [filters.locationId, filters.staffIds, load, openEvent, router, selectedDayKey, shift, view],
  );

  const agendaRangeLabel = useMemo(() => {
    const { from, to } = getCalendarRange(cursor, "agenda");
    const a = from.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const b = to.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${a} – ${b}`;
  }, [cursor]);

  if (loading && !rows.length) return <CalendarLoadingShell />;
  if (failed && !rows.length) return <CalendarError onRetry={load} />;
  if (!model) return <CalendarError onRetry={load} />;

  return (
    <div className="appt-overview-pilot bookable-workspace-pilot cal-page-shell">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[var(--text-muted)]">
            Operational schedule — services, classes, team bookings, and resources in one view.
          </p>
          <div className="flex gap-2">
            <button type="button" className="appt-pilot-secondary-btn" onClick={() => setFiltersOpen((v) => !v)}>
              {filtersOpen ? "Hide filters" : "Filters"}
            </button>
            <button type="button" className="appt-pilot-secondary-btn" onClick={() => router.push("/appointments/availability?section=overrides")}>
              Block time
            </button>
          </div>
        </div>
      </div>
      <CalendarFilterBar
        workspace={workspace}
        filters={filters}
        onChange={setFilters}
        collapsed={!filtersOpen}
      />
      {refreshing && <div className="cal-refresh-bar" aria-live="polite">Updating…</div>}
      {view === "agenda" ? (
        <div className="cal-page cal-page-agenda">
          <CalendarHeader
            rangeLabel={agendaRangeLabel}
            view={view}
            onToday={actions.onToday}
            onPrev={actions.onPrev}
            onNext={actions.onNext}
            onViewChange={actions.onViewChange}
            onNewAppointment={actions.onNewAppointment}
          />
          <div className="px-4 pb-6 lg:px-6">
            <AgendaListView rows={rows} onSelect={openEvent} />
          </div>
        </div>
      ) : (
        <CalendarView model={model} actions={actions} headerView={view} hideStatCards />
      )}
      <CalendarEventDrawer
        event={drawerId ? rowById.get(drawerId) || rows.find((r) => r.id === drawerId) || null : null}
        onClose={() => setDrawerId(null)}
        onRefresh={load}
      />
    </div>
  );
}
