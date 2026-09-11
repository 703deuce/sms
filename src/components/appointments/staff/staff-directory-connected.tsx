"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { useStaffWorkspace } from "@/features/appointments/kimi/staff/use-staff-workspace";
import { CreateStaffModal } from "./create-staff-modal";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

type StatusFilter = "all" | "active" | "inactive" | "needs_setup";

function Avatar({ initials, url }: { initials: string; url: string | null }) {
  if (url) {
    return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent)]">
      {initials}
    </span>
  );
}

export function StaffDirectoryConnected() {
  const ws = useStaffWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(() => {
    const list = ws.data?.directory || [];
    return list.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.title || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q)
      );
    });
  }, [ws.data, filter, query]);

  const summary = ws.data?.summary;

  if (ws.loading) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] animate-pulse space-y-3">
          <div className="h-10 w-48 rounded bg-[var(--surface)]" />
          <div className="h-64 rounded bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="ws-icon-tile mt-0.5" aria-hidden>
                <Users className="h-4 w-4" />
              </span>
              <div>
                <h1 className="ws-event-title">Staff</h1>
                <p className="ws-event-subtitle">
                  Manage providers, hosts, assignments, locations, and staff scheduling setup.
                </p>
              </div>
            </div>
            <button type="button" className="appt-pilot-primary-btn" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 inline h-4 w-4" aria-hidden />
              Add staff
            </button>
          </div>
        </header>

        {summary && (
          <div className="flex flex-wrap gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs lg:px-6">
            <span><strong>{summary.activeStaff}</strong> active</span>
            <span><strong>{summary.bookable}</strong> bookable</span>
            <span><strong>{summary.needsSetup}</strong> needs setup</span>
            <span>
              Calendar <strong>{summary.calendarConnected}</strong> / {summary.calendarTotal}
            </span>
            <span><strong>{summary.locations}</strong> locations</span>
          </div>
        )}

        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:px-6">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-[var(--text-muted)]" />
              <input
                className="w-full rounded-md border border-[var(--border)] py-1.5 pl-7 pr-2"
                placeholder="Search name, role, email"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search staff"
              />
            </div>
            <div className="flex flex-wrap gap-1" role="tablist" aria-label="Status filter">
              {(["all", "active", "needs_setup", "inactive"] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  className={`rounded-md px-2 py-1 ${filter === f ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-muted)]"}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "all" ? "All" : f === "needs_setup" ? "Needs setup" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {ws.error && (
            <p className="text-sm text-red-600" role="alert">
              {ws.error}{" "}
              <button type="button" className="underline" onClick={() => ws.reload()}>Retry</button>
            </p>
          )}

          {!rows.length && !ws.error && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
              No staff yet. Add your first provider to assign services and locations.
            </div>
          )}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Staff</th>
                    <th className="px-3 py-2 font-medium">Role / title</th>
                    <th className="px-3 py-2 font-medium">Services</th>
                    <th className="px-3 py-2 font-medium">Locations</th>
                    <th className="px-3 py-2 font-medium">Availability</th>
                    <th className="px-3 py-2 font-medium">Calendar</th>
                    <th className="px-3 py-2 font-medium">Public</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar initials={row.initials} url={row.avatarUrl} />
                          <div>
                            <div className="font-medium text-[var(--text-primary)]">{row.name}</div>
                            {row.email && <div className="text-[var(--text-muted)]">{row.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">{row.title || "—"}</td>
                      <td className="px-3 py-2">{row.serviceCount} Services</td>
                      <td className="px-3 py-2">{row.locationLabels}</td>
                      <td className="px-3 py-2">{row.availabilityLabel}</td>
                      <td className="px-3 py-2">{row.calendarConnected ? `${row.calendarLabel} ✓` : row.calendarLabel}</td>
                      <td className="px-3 py-2">{row.publicLabel}</td>
                      <td className="px-3 py-2">
                        <span className="ws-chip">{row.statusLabel}</span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/appointments/staff/${row.id}`} className="text-[var(--accent)] hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {createOpen && (
        <CreateStaffModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            ws.reload();
            window.location.href = `/appointments/staff/${id}`;
          }}
        />
      )}
    </div>
  );
}
