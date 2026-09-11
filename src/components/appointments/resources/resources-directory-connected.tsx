"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Box, Plus, Search } from "lucide-react";
import { useResourcesWorkspace } from "@/features/appointments/kimi/resources/use-resources-workspace";
import { CreateResourceModal } from "./create-resource-modal";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

export function ResourcesDirectoryConnected() {
  const ws = useResourcesWorkspace();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locationId = searchParams.get("locationId");
  const [createOpen, setCreateOpen] = useState(false);

  if (ws.loading && !ws.data) {
    return (
      <div className={`${SHELL} min-h-full bg-[var(--surface-muted)] p-8`}>
        <div className="mx-auto max-w-[1560px] h-64 animate-pulse rounded bg-[var(--surface)]" />
      </div>
    );
  }

  const summary = ws.data?.summary;

  return (
    <div className={`${SHELL} min-h-full bg-[var(--surface-muted)]`}>
      <div className="mx-auto w-full max-w-[1560px]">
        <header className="ws-event-head border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="ws-icon-tile mt-0.5"><Box className="h-4 w-4" /></span>
              <div>
                <h1 className="ws-event-title">Resources</h1>
                <p className="ws-event-subtitle">
                  Manage rooms, equipment, vehicles, stations, and other limited resources used by bookings.
                </p>
              </div>
            </div>
            <button type="button" className="appt-pilot-primary-btn" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 inline h-4 w-4" /> Add resource
            </button>
          </div>
        </header>

        {summary && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs lg:px-6">
            <span><strong>{summary.active}</strong> active resources</span>
            <span><strong>{summary.pools}</strong> pools</span>
            <span><strong>{summary.locations}</strong> locations</span>
            <span><strong>{summary.servicesUsing}</strong> services using resources</span>
            {summary.needsAttention > 0 && (
              <span className="text-amber-700"><strong>{summary.needsAttention}</strong> need setup</span>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:px-6">
          <div className="relative min-w-[200px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              className="w-full rounded-md border border-[var(--border)] py-1.5 pl-7 pr-2 text-xs"
              placeholder="Search name, type, location"
              value={ws.q}
              onChange={(e) => ws.setQ(e.target.value)}
              aria-label="Search resources"
            />
          </div>
          <select
            className="rounded border border-[var(--border)] px-2 py-1.5 text-xs"
            value={ws.typeFilter}
            onChange={(e) => ws.setTypeFilter(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {ws.typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            className="rounded border border-[var(--border)] px-2 py-1.5 text-xs"
            value={ws.statusFilter}
            onChange={(e) => ws.setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="needs_setup">Needs setup</option>
          </select>
        </div>

        <div className="p-4 lg:p-6">
          {ws.error && <p className="text-sm text-red-600">{ws.error}</p>}
          {ws.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Resource</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Capacity</th>
                    <th className="px-3 py-2">Used by</th>
                    <th className="px-3 py-2">Availability</th>
                    <th className="px-3 py-2">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ws.rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 font-medium">
                          <Box className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          {row.name}
                        </div>
                      </td>
                      <td className="px-3 py-2"><span className="ws-chip">{row.typeLabel}</span></td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{row.locationLabel}</td>
                      <td className="px-3 py-2">{row.quantity > 1 ? `${row.quantity} units` : row.quantity}</td>
                      <td className="px-3 py-2">{row.usedByCount} services</td>
                      <td className="px-3 py-2">{row.availabilityLabel}</td>
                      <td className="px-3 py-2"><span className="ws-chip">{row.statusLabel}</span></td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/appointments/resources/${row.id}`} className="text-[var(--accent)]">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!ws.rows.length && !ws.error && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
              No resources yet. Add rooms, equipment pools, vehicles, or stations required for booking.
            </div>
          )}
        </div>
      </div>

      {createOpen && ws.data && (
        <CreateResourceModal
          onClose={() => setCreateOpen(false)}
          locations={ws.data.locations}
          services={ws.data.types}
          defaultLocationIds={locationId ? [locationId] : undefined}
          onCreated={(id) => {
            void ws.reload();
            router.push(`/appointments/resources/${id}`);
          }}
        />
      )}
    </div>
  );
}
