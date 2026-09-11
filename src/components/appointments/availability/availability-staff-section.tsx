"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import type { StaffAvailabilityRow } from "@/lib/appointments/availability/availability-workspace";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";
import { AvailabilityStaffDrawer } from "./availability-staff-drawer";

type Props = {
  rows: StaffAvailabilityRow[];
  form: AvailabilityFormState;
  services: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  onUseBusinessHours: (staffId: string) => void;
  onToggleService: (staffId: string, typeId: string, included: boolean) => void;
  onToggleLocation: (staffId: string, locationId: string, included: boolean) => void;
  onToggleDay: (staffId: string, day: string, open: boolean) => void;
  onUpdateWindow: (staffId: string, day: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (staffId: string, day: string) => void;
  onRemoveWindow: (staffId: string, day: string, index: number) => void;
};

export function AvailabilityStaffSection({
  rows,
  form,
  services,
  locations,
  onUseBusinessHours,
  onToggleService,
  onToggleLocation,
  onToggleDay,
  onUpdateWindow,
  onAddWindow,
  onRemoveWindow,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) || null;

  if (!rows.length) {
    return (
      <div className="ws-empty">
        <h2 className="ws-empty-title">No staff availability configured</h2>
        <p className="ws-empty-copy">Add staff members and assign schedules to begin taking bookings.</p>
        <Link href="/appointments/staff" className="appt-pilot-primary-btn">Set availability</Link>
      </div>
    );
  }

  return (
    <>
      <div className="ws-panel overflow-hidden">
        <table className="ws-table">
          <thead>
            <tr>
              <th scope="col">Staff</th>
              <th scope="col">Availability source</th>
              <th scope="col">Schedule</th>
              <th scope="col">Services</th>
              <th scope="col">Locations</th>
              <th scope="col">Calendar</th>
              <th scope="col">Status</th>
              <th scope="col" className="w-16 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="ws-row-item is-selectable">
                <th scope="row">
                  <button type="button" className="flex items-center gap-2 text-left" onClick={() => setSelectedId(row.id)}>
                    <span className="ws-avatar is-compact" aria-hidden>{row.initials}</span>
                    <span className="font-medium text-[var(--text-primary)]">{row.name}</span>
                  </button>
                </th>
                <td>{row.sourceLabel}</td>
                <td>{row.scheduleSummary}</td>
                <td>{row.serviceCount} service{row.serviceCount === 1 ? "" : "s"}</td>
                <td>{row.locationCount > 0 ? `${row.locationCount} location${row.locationCount === 1 ? "" : "s"}` : "—"}</td>
                <td>{row.calendarConnected ? row.calendarLabel : "Not connected"}</td>
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
        <AvailabilityStaffDrawer
          row={selected}
          form={form}
          services={services}
          locations={locations}
          onClose={() => setSelectedId(null)}
          onUseBusinessHours={() => onUseBusinessHours(selected.id)}
          onToggleService={(typeId, included) => onToggleService(selected.id, typeId, included)}
          onToggleLocation={(locationId, included) => onToggleLocation(selected.id, locationId, included)}
          onToggleDay={(day, open) => onToggleDay(selected.id, day, open)}
          onUpdateWindow={(day, index, field, value) => onUpdateWindow(selected.id, day, index, field, value)}
          onAddWindow={(day) => onAddWindow(selected.id, day)}
          onRemoveWindow={(day, index) => onRemoveWindow(selected.id, day, index)}
        />
      ) : null}
    </>
  );
}
