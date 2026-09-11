"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import type { ServiceAvailabilityRow } from "@/lib/appointments/availability/availability-workspace";

type Props = {
  rows: ServiceAvailabilityRow[];
};

export function AvailabilityServicesSection({ rows }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) || null;

  if (!rows.length) {
    return (
      <div className="ws-empty">
        <h2 className="ws-empty-title">No services configured</h2>
        <p className="ws-empty-copy">Create services to manage staff eligibility and timing rules.</p>
        <Link href="/appointments/services" className="appt-pilot-primary-btn">Open services</Link>
      </div>
    );
  }

  return (
    <>
      <div className="ws-panel overflow-hidden">
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">Service</th>
              <th scope="col">Duration</th>
              <th scope="col">Eligible staff</th>
              <th scope="col">Locations</th>
              <th scope="col">Availability</th>
              <th scope="col">Timing rules</th>
              <th scope="col">Status</th>
              <th scope="col" className="w-16 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="ws-row-item is-selectable">
                <th scope="row">
                  <button type="button" className="font-medium text-[var(--text-primary)]" onClick={() => setSelectedId(row.id)}>
                    {row.name}
                  </button>
                </th>
                <td>{row.durationMinutes} min</td>
                <td>{row.eligibleStaffCount} staff</td>
                <td>{row.locationCount}</td>
                <td>{row.availabilityLabel}</td>
                <td>{row.timingRules}</td>
                <td>
                  <span className={row.status === "ready" ? "ws-badge is-success" : "ws-badge is-warning"}>
                    {row.statusLabel}
                  </span>
                </td>
                <td className="text-right">
                  <button type="button" className="ws-icon-btn" aria-label={`Actions for ${row.name}`} onClick={() => setSelectedId(row.id)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" role="dialog" aria-modal="true">
          <button type="button" className="flex-1" aria-label="Close" onClick={() => setSelectedId(null)} />
          <aside className="h-full w-full max-w-md border-l border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
            <h2 className="text-[var(--type-section)] font-semibold">{selected.name}</h2>
            <p className="ws-stat-note mb-4">{selected.durationMinutes} min · {selected.timingRules}</p>
            <dl className="space-y-3 text-[var(--type-list)]">
              <div>
                <dt className="ws-field-label">Eligible staff</dt>
                <dd>{selected.eligibleStaffCount} assigned via Staff & place</dd>
              </div>
              <div>
                <dt className="ws-field-label">Locations</dt>
                <dd>{selected.locationCount} location{selected.locationCount === 1 ? "" : "s"}</dd>
              </div>
              <div>
                <dt className="ws-field-label">Buffers</dt>
                <dd>
                  Before {selected.config.bufferBeforeMinutes ?? 0} min · After {selected.config.bufferAfterMinutes ?? 0} min
                </dd>
              </div>
              <div>
                <dt className="ws-field-label">Fixed start times</dt>
                <dd>
                  {selected.config.schedulingLimits?.fixedStartTimes?.enabled
                    ? (selected.config.schedulingLimits.fixedStartTimes.times || []).join(", ") || "Enabled"
                    : "Interval-based"}
                </dd>
              </div>
              <div>
                <dt className="ws-field-label">Resources</dt>
                <dd>{(selected.config.resourceIds || []).length} required resource(s)</dd>
              </div>
            </dl>
            <Link href={`/appointments/services/${selected.id}?section=staff-place`} className="appt-pilot-primary-btn mt-6 inline-flex">
              Open service
            </Link>
          </aside>
        </div>
      ) : null}
    </>
  );
}
