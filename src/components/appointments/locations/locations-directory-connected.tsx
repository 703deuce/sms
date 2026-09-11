"use client";

import Link from "next/link";
import { useState } from "react";
import { MapPin, Plus, Search } from "lucide-react";
import { useLocationsWorkspace } from "@/features/appointments/kimi/locations/use-locations-workspace";
import { CreateLocationModal } from "./create-location-modal";
import "@/components/appointments/kimi-ui/shared/appointments-pilot-tokens.css";
import "@/components/appointments/kimi-ui/shared/bookable-workspace-pilot.css";
import "@/components/appointments/kimi-ui/shared/workspace-pilot.css";
import "@/components/appointments/kimi-ui/overview/appointments-overview-pilot.css";
import "@/components/appointments/kimi-ui/overview/reference.css";

const SHELL =
  "appt-overview-pilot bookable-workspace-pilot ws-pilot appt-pilot-workspace ref-root";

export function LocationsDirectoryConnected() {
  const ws = useLocationsWorkspace();
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
              <span className="ws-icon-tile mt-0.5"><MapPin className="h-4 w-4" /></span>
              <div>
                <h1 className="ws-event-title">Locations</h1>
                <p className="ws-event-subtitle">
                  Manage where services are offered, which staff work there, and how customers see each location.
                </p>
              </div>
            </div>
            <button type="button" className="appt-pilot-primary-btn" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1 inline h-4 w-4" /> Add location
            </button>
          </div>
        </header>

        {summary && (
          <div className="flex flex-wrap gap-4 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs lg:px-6">
            <span><strong>{summary.active}</strong> active</span>
            <span><strong>{summary.physical}</strong> physical</span>
            <span><strong>{summary.virtual}</strong> virtual</span>
            {summary.needsSetup > 0 && <span><strong>{summary.needsSetup}</strong> need setup</span>}
          </div>
        )}

        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:px-6">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-[var(--text-muted)]" />
            <input
              className="w-full rounded-md border border-[var(--border)] py-1.5 pl-7 pr-2 text-xs"
              placeholder="Search name or address"
              value={ws.q}
              onChange={(e) => ws.setQ(e.target.value)}
              aria-label="Search locations"
            />
          </div>
        </div>

        <div className="p-4 lg:p-6">
          {ws.error && <p className="text-sm text-red-600">{ws.error}</p>}
          {ws.rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-b border-[var(--border)] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Address / method</th>
                    <th className="px-3 py-2">Services</th>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Resources</th>
                    <th className="px-3 py-2">Availability</th>
                    <th className="px-3 py-2">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ws.rows.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-muted)]">
                      <td className="px-3 py-2 font-medium">{row.name}</td>
                      <td className="px-3 py-2"><span className="ws-chip">{row.typeLabel}</span></td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{row.addressLabel}</td>
                      <td className="px-3 py-2">{row.serviceCount}</td>
                      <td className="px-3 py-2">{row.staffCount}</td>
                      <td className="px-3 py-2">{row.resourceCount}</td>
                      <td className="px-3 py-2">{row.availabilityLabel}</td>
                      <td className="px-3 py-2"><span className="ws-chip">{row.statusLabel}</span></td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/appointments/locations/${row.id}`} className="text-[var(--accent)]">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!ws.rows.length && !ws.error && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--text-muted)]">
              No locations yet. Add a physical studio, virtual option, or customer-location label.
            </div>
          )}
        </div>
      </div>
      {createOpen && (
        <CreateLocationModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            window.location.href = `/appointments/locations/${id}`;
          }}
        />
      )}
    </div>
  );
}
