"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@/components/appointments/kimi-ui/list/reference.css";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import { AppointmentsList } from "@/components/appointments/kimi-ui/list/components/AppointmentsList";
import type { AppointmentRow } from "@/components/appointments/kimi-ui/list/list-types";
import { AppointmentsListFilters } from "@/components/appointments/list/appointments-list-filters";

const SHELL = "appt-overview-pilot bookable-workspace-pilot";

type Summary = {
  today: number;
  upcoming: number;
  attention: number;
  unpaid: number;
  formsDue: number;
  total: number;
};

export function ListConnected() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(() => searchParams.get("tab") || "upcoming");
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [rows, setRows] = useState<AppointmentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [workspace, setWorkspace] = useState<{
    staff: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
  } | null>(null);
  const [filters, setFilters] = useState({
    staffId: "",
    locationId: "",
    resourceId: "",
    domainType: "all",
    payment: "",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bookingTypes, setBookingTypes] = useState<
    Array<{ id: string; name: string; durationMinutes: number; location?: string | null }>
  >([]);
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "empty">("loading");

  useEffect(() => {
    fetch("/api/appointments/list/workspace")
      .then((r) => r.json())
      .then((json) => {
        setWorkspace(json.data);
        const staff = (json.data?.staff || []).map((s: { name: string }) => s.name);
        if (staff.length) setStaffNames(staff);
        setBookingTypes(
          (json.data?.services || []).map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
            durationMinutes: 30,
            location: null,
          })),
        );
      })
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    setState("loading");
    const params = new URLSearchParams({ tab });
    if (q.trim()) params.set("q", q.trim());
    if (filters.staffId) params.set("staffIds", filters.staffId);
    if (filters.locationId) params.set("locationId", filters.locationId);
    if (filters.resourceId) params.set("resourceId", filters.resourceId);
    if (filters.domainType !== "all") params.set("domainType", filters.domainType);
    if (filters.payment) params.set("payment", filters.payment);
    if (tab === "attention") params.set("attention", "1");

    fetch(`/api/appointments?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json();
      })
      .then((json) => {
        const data = (json.data || []) as AppointmentRow[];
        setRows(data);
        setSummary(json.summary || null);
        setState(data.length === 0 && tab === "all" && !q.trim() ? "empty" : "ready");
      })
      .catch(() => setState("error"));
  }, [filters, q, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    if (q) params.set("q", q);
    router.replace(`/appointments?${params.toString()}`, { scroll: false });
  }, [q, router, tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const row of rows) c[row.status] = (c[row.status] || 0) + 1;
    return c;
  }, [rows]);

  const cancelAppointment = useCallback(
    async (id: string) => {
      if (id.startsWith("enroll:")) return;
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not cancel appointment");
      }
      load();
    },
    [load],
  );

  const rescheduleAppointment = useCallback(
    async (id: string, startsAt: string) => {
      if (id.startsWith("enroll:")) return;
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Could not reschedule appointment");
      }
      load();
    },
    [load],
  );

  return (
    <div className={`${SHELL} tv-page tv-page--wide`}>
      {summary && (
        <div className="tv-summary-strip">
          <span><strong>{summary.today}</strong> today</span>
          <span><strong>{summary.upcoming}</strong> upcoming</span>
          {summary.attention > 0 && <span><strong>{summary.attention}</strong> need attention</span>}
          {summary.unpaid > 0 && <span><strong>{summary.unpaid}</strong> unpaid</span>}
        </div>
      )}
      <AppointmentsListFilters
        open={filtersOpen}
        workspace={workspace}
        filters={filters}
        onChange={setFilters}
        onToggle={() => setFiltersOpen((v) => !v)}
      />
      <AppointmentsList
        tab={tab}
        onTabChange={setTab}
        q={q}
        onSearch={setQ}
        state={state}
        rows={rows}
        counts={counts}
        onRetry={load}
        bookingTypes={bookingTypes}
        staffNames={staffNames}
        onCreateAppointment={async () => {
          router.push("/appointments/new");
        }}
        onCanceled={cancelAppointment}
        onRescheduled={rescheduleAppointment}
        onNavigateToDetail={(id) => {
          if (id.startsWith("enroll:")) {
            router.push(`/appointments/classes`);
            return;
          }
          router.push(`/appointments/${id}`);
        }}
        onNavigateToMessage={(row) => {
          if (row.contact?.id) {
            router.push(`/conversations?contactId=${row.contact.id}`);
            return;
          }
          router.push("/conversations");
        }}
        onNavigateToBooking={() => router.push("/appointments/booking")}
        onNavigateCalendar={() => router.push("/appointments/calendar")}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
      />
    </div>
  );
}
