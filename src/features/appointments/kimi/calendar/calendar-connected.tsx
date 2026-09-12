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
import {
  CalendarQuickCreateSheet,
  type QuickCreatePrefill,
} from "@/components/appointments/calendar/calendar-quick-create-sheet";
import { CalendarAddMenu } from "@/components/appointments/calendar/calendar-add-menu";
import { appendReturnTo } from "@/lib/navigation/return-context";
import { wallTimeInZoneToUtc, zonedDateParts } from "@/lib/voice/calendar/timezone-slots";
import { CalendarRecurringScopeDialog } from "@/components/appointments/calendar/calendar-recurring-scope-dialog";
import {
  CalendarWaitlistMatchDrawer,
  type OpenSlotSummary,
  type WaitlistMatchRow,
} from "@/components/appointments/calendar/calendar-waitlist-match-drawer";
import {
  buildCalendarSearchParams,
  calendarUrlEquals,
  parseCalendarCursorFromSearch,
  parseCalendarFiltersFromSearch,
  parseCalendarView,
} from "@/features/appointments/kimi/calendar/calendar-url-state";
import { useCalendarReschedule } from "@/features/appointments/kimi/calendar/use-calendar-reschedule";

const FILTER_KEY = "tv-calendar-filters";

function loadFiltersFallback(): CalendarFilters {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) return JSON.parse(raw) as CalendarFilters;
  } catch {
    /* ignore */
  }
  return { q: "", staffIds: [], locationId: "", resourceId: "", status: "all", domainType: "all" };
}

function isCanceledStatus(status: string) {
  return status === "canceled" || status === "cancelled";
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
  const initialView = parseCalendarView(searchParams.get("view"));
  const [cursor, setCursor] = useState(() =>
    parseCalendarCursorFromSearch(new URLSearchParams(searchParams.toString()), initialView),
  );
  const [view, setView] = useState<CalendarViewMode>(initialView);
  const [selectedDayKey, setSelectedDayKey] = useState(() => {
    const d = parseCalendarCursorFromSearch(
      new URLSearchParams(searchParams.toString()),
      initialView,
    );
    return dateKey(initialView === "week" ? d : d);
  });
  const [miniCalendarMonth, setMiniCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [rows, setRows] = useState<CalendarApiAppointment[]>([]);
  const [rowById, setRowById] = useState<Map<string, CalendarApiAppointment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<CalendarFilters>(() => {
    const fromUrl = parseCalendarFiltersFromSearch(new URLSearchParams(searchParams.toString()));
    if (
      fromUrl.q ||
      fromUrl.staffIds.length ||
      fromUrl.locationId ||
      fromUrl.resourceId ||
      fromUrl.status !== "all" ||
      fromUrl.domainType !== "all"
    ) {
      return fromUrl;
    }
    return loadFiltersFallback();
  });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [secondaryFilters, setSecondaryFilters] = useState(false);
  const [workspace, setWorkspace] = useState<{
    staff: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
    resources: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
    timezone?: string;
  } | null>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [quickCreate, setQuickCreate] = useState<QuickCreatePrefill | null>(null);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [slotWaitlistCounts, setSlotWaitlistCounts] = useState<Record<string, number>>({});
  const [waitlistDrawer, setWaitlistDrawer] = useState<OpenSlotSummary | null>(null);
  const [waitlistMatches, setWaitlistMatches] = useState<WaitlistMatchRow[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistBusyEntry, setWaitlistBusyEntry] = useState<string | null>(null);
  const [cancelWaitlistBanner, setCancelWaitlistBanner] = useState<OpenSlotSummary | null>(null);

  const range = useMemo(() => getCalendarRange(cursor, view), [cursor, view]);

  useEffect(() => {
    fetch("/api/appointments/calendar/workspace")
      .then((r) => r.json())
      .then((json) => setWorkspace(json.data || null))
      .catch(() => setWorkspace(null));
  }, []);

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

  const {
    dragOverrides,
    onDragPreview,
    onDragClear,
    onDragCommit: baseDragCommit,
    beginReschedule,
    recurringOpen,
    setRecurringOpen,
    confirmRecurring,
    toast,
    setToast,
  } = useCalendarReschedule(load);

  const fetchWaitlistMatches = useCallback(async (slot: OpenSlotSummary) => {
    setWaitlistLoading(true);
    try {
      const params = new URLSearchParams({ startsAt: slot.startsAt });
      if (slot.endsAt) params.set("endsAt", slot.endsAt);
      if (slot.serviceName) params.set("serviceName", slot.serviceName);
      if (slot.staffLabel) {
        const staff = workspace?.staff.find((s) => s.name === slot.staffLabel);
        if (staff) params.set("staffId", staff.id);
      }
      const res = await fetch(`/api/appointments/calendar/waitlist-match?${params}`);
      const json = await res.json();
      setWaitlistMatches((json.data?.matches || []) as WaitlistMatchRow[]);
    } catch {
      setWaitlistMatches([]);
    } finally {
      setWaitlistLoading(false);
    }
  }, [workspace?.staff]);

  const openWaitlistDrawer = useCallback(
    (slot: OpenSlotSummary) => {
      setWaitlistDrawer(slot);
      void fetchWaitlistMatches(slot);
    },
    [fetchWaitlistMatches],
  );

  useEffect(() => {
    const canceled = rows.filter((r) => isCanceledStatus(r.status));
    if (!canceled.length) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, number> = {};
      for (const row of canceled.slice(0, 12)) {
        const start = new Date(row.startsAt);
        const hour = start.getHours();
        const key = `${dateKey(start)}:${hour}`;
        const params = new URLSearchParams({
          startsAt: row.startsAt,
          serviceName: row.serviceName || "Appointment",
        });
        if (row.staffIds?.[0]) params.set("staffId", row.staffIds[0]);
        if (row.locationId) params.set("locationId", row.locationId);
        const res = await fetch(`/api/appointments/calendar/waitlist-match?${params}`);
        if (!res.ok) continue;
        const json = await res.json();
        const count = Number(json.data?.count || 0);
        if (count > 0) next[key] = count;
        if (cancelled) return;
      }
      if (!cancelled) setSlotWaitlistCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  useEffect(() => {
    const next = buildCalendarSearchParams({ view, cursor, selectedDayKey, filters });
    const apptId = searchParams.get("appointmentId");
    if (apptId) next.set("appointmentId", apptId);
    const current = new URLSearchParams(searchParams.toString());
    if (!calendarUrlEquals(next, current)) {
      router.replace(`/appointments/calendar?${next.toString()}`, { scroll: false });
    }
  }, [cursor, filters, router, searchParams, selectedDayKey, view]);

  useEffect(() => {
    const apptId = searchParams.get("appointmentId");
    if (apptId) setDrawerId(apptId);
    const contactId = searchParams.get("contactId");
    if (contactId && !searchParams.get("appointmentId")) {
      router.push(`/appointments/new?contactId=${encodeURIComponent(contactId)}`);
    }
  }, [router, searchParams]);

  const calendarReturnTo = useMemo(
    () => `/appointments/calendar?${buildCalendarSearchParams({ view, cursor, selectedDayKey, filters }).toString()}`,
    [cursor, filters, selectedDayKey, view],
  );

  const timeZone = workspace?.timezone || "America/Chicago";

  const model: CalendarPageModel | null = useMemo(() => {
    const base = buildCalendarPageModel({
      appointments: rows,
      cursor,
      view: view === "agenda" ? "week" : view,
      selectedDayKey,
      miniCalendarMonth,
    });
    if (!Object.keys(dragOverrides).length) return base;
    return {
      ...base,
      weekEvents: base.weekEvents.map((ev) => {
        const o = dragOverrides[ev.id];
        if (!o) return ev;
        return { ...ev, day: o.day, start: o.start };
      }),
    };
  }, [cursor, dragOverrides, miniCalendarMonth, rows, selectedDayKey, view]);

  const onDragCommit = useCallback(
    (input: { id: string; startsAt: string }) => {
      const row = rowById.get(input.id);
      const meta = (row?.metadata || {}) as { recurringSeriesId?: string };
      baseDragCommit(input, meta.recurringSeriesId);
    },
    [baseDragCommit, rowById],
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
        if (nextView === "month") setSideCollapsed(true);
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
      onBlockTime: () => router.push("/appointments/availability?section=overrides"),
      onWaitlist: () => router.push("/appointments/waitlist"),
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
        setQuickCreate({
          startsAt: d.toISOString(),
          staffId: filters.staffIds[0],
          locationId: filters.locationId || undefined,
          serviceId: workspace?.services[0]?.id,
        });
      },
      timeZone,
      dragOverrides,
      onDragPreview,
      onDragClear,
      onDragCommit,
      slotWaitlistCounts,
      sideCollapsed,
      onToggleSide: () => setSideCollapsed((v) => !v),
      onMonthEventDrop: ({ id, targetDateKey }) => {
        const row = rowById.get(id);
        if (!row?.startsAt || !row.serviceName) return;
        const parts = zonedDateParts(new Date(row.startsAt), timeZone);
        const target = new Date(targetDateKey);
        const isoDate = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
        const [y, mo, d] = isoDate.split("-").map(Number);
        const nextIso = wallTimeInZoneToUtc(timeZone, y, mo, d, parts.hour, parts.minute).toISOString();
        const meta = (row.metadata || {}) as { recurringSeriesId?: string };
        void beginReschedule(id, nextIso, meta.recurringSeriesId);
      },
      onWaitlistSlotClick: ({ dateKey: dk, hour }) => {
        const d = new Date(dk);
        d.setHours(hour, 0, 0, 0);
        const end = new Date(d.getTime() + 60 * 60_000);
        openWaitlistDrawer({
          startsAt: d.toISOString(),
          endsAt: end.toISOString(),
          serviceName: workspace?.services[0]?.name,
          staffLabel: workspace?.staff.find((s) => s.id === filters.staffIds[0])?.name,
          locationLabel: workspace?.locations.find((l) => l.id === filters.locationId)?.name,
        });
      },
    }),
    [
      dragOverrides,
      filters.locationId,
      filters.staffIds,
      load,
      onDragClear,
      onDragCommit,
      onDragPreview,
      openEvent,
      openWaitlistDrawer,
      router,
      selectedDayKey,
      shift,
      slotWaitlistCounts,
      view,
      timeZone,
      rowById,
      workspace,
    ],
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
      <CalendarFilterBar
        workspace={workspace}
        filters={filters}
        onChange={setFilters}
        collapsed={!filtersOpen}
        showSecondary={false}
        onWaitlist={() => router.push("/appointments/waitlist")}
        onAdd={() => router.push(appendReturnTo("/appointments/new", calendarReturnTo))}
        secondaryFiltersOpen={secondaryFilters}
        onToggleSecondaryFilters={() => setSecondaryFilters((v) => !v)}
        onSearchSubmit={() => {
          const q = filters.q.trim().toLowerCase();
          if (!q) return;
          const match = rows.find(
            (r) =>
              (r.inviteeName || "").toLowerCase().includes(q) ||
              (r.serviceName || "").toLowerCase().includes(q) ||
              r.id.toLowerCase().includes(q),
          );
          if (!match) return;
          const d = new Date(match.startsAt);
          setCursor(view === "week" ? startOfWeek(d) : d);
          setSelectedDayKey(dateKey(d));
          setDrawerId(match.id);
        }}
      />
      {toast ? (
        <div className="cal-toast-error" role="alert">
          {toast}
          <button type="button" className="ml-2 underline" onClick={() => setToast(null)}>Dismiss</button>
        </div>
      ) : null}
      {cancelWaitlistBanner ? (
        <div className="cal-waitlist-cancel-banner mx-4 my-2 rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs lg:mx-6">
          <span>
            {waitlistMatches.length
              ? `${waitlistMatches.length} waitlist client${waitlistMatches.length === 1 ? "" : "s"} match this opening.`
              : "Checking waitlist matches for this opening…"}
          </span>
          <button
            type="button"
            className="ml-2 underline"
            onClick={() => openWaitlistDrawer(cancelWaitlistBanner)}
          >
            View matches
          </button>
          <button type="button" className="ml-2 text-[var(--muted)]" onClick={() => setCancelWaitlistBanner(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
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
            onBlockTime={actions.onBlockTime}
            onWaitlist={actions.onWaitlist}
            hideTitleBlock
            sideCollapsed={sideCollapsed}
            onToggleSide={() => setSideCollapsed((v) => !v)}
          />
          <div className="px-4 pb-6 lg:px-6">
            <AgendaListView rows={rows} onSelect={openEvent} />
          </div>
        </div>
      ) : (
        <CalendarView
          model={model}
          actions={actions}
          headerView={view}
          hideStatCards
          sideCollapsed={sideCollapsed}
          onToggleSide={() => setSideCollapsed((v) => !v)}
        />
      )}
      <CalendarQuickCreateSheet
        open={Boolean(quickCreate)}
        prefill={quickCreate}
        workspace={workspace}
        onClose={() => setQuickCreate(null)}
        onCreated={load}
        onOpenFullForm={(q) => {
          setQuickCreate(null);
          router.push(`/appointments/new?${q.toString()}`);
        }}
        onViewWaitlistMatches={(slot) => {
          openWaitlistDrawer({
            startsAt: slot.startsAt,
            serviceName: slot.serviceName,
            staffLabel: workspace?.staff.find((s) => s.id === filters.staffIds[0])?.name,
            locationLabel: workspace?.locations.find((l) => l.id === filters.locationId)?.name,
          });
        }}
      />
      <CalendarEventDrawer
        event={drawerId ? rowById.get(drawerId) || rows.find((r) => r.id === drawerId) || null : null}
        onClose={() => setDrawerId(null)}
        onRefresh={load}
        returnTo={calendarReturnTo}
        onReschedule={(appointmentId, startsAt) => {
          const row = rowById.get(appointmentId);
          const meta = (row?.metadata || {}) as { recurringSeriesId?: string };
          void beginReschedule(appointmentId, startsAt, meta.recurringSeriesId);
        }}
        onCanceled={(slot) => {
          setCancelWaitlistBanner(slot);
          void fetchWaitlistMatches(slot).then(() => undefined);
        }}
      />
      <CalendarRecurringScopeDialog
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        onConfirm={confirmRecurring}
      />
      <CalendarWaitlistMatchDrawer
        open={Boolean(waitlistDrawer)}
        slot={waitlistDrawer}
        matches={waitlistMatches}
        loading={waitlistLoading}
        busyEntryId={waitlistBusyEntry}
        onClose={() => setWaitlistDrawer(null)}
        onOffer={async (entryId) => {
          if (!waitlistDrawer) return;
          setWaitlistBusyEntry(entryId);
          try {
            await fetch("/api/appointments/waitlist", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                entryId,
                action: "notify",
                serviceName: waitlistDrawer.serviceName,
                startsAt: waitlistDrawer.startsAt,
              }),
            });
          } finally {
            setWaitlistBusyEntry(null);
          }
        }}
      />
    </div>
  );
}
