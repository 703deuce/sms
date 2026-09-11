"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";
import { formatWindowRange } from "@/lib/appointments/availability/availability-workspace";

type Props = {
  form: AvailabilityFormState;
  onPatch: (patch: Partial<AvailabilityFormState>) => void;
  onAddOverride: () => void;
  onRemoveOverride: (date: string) => void;
};

export function AvailabilityOverridesSection({ form, onPatch, onAddOverride, onRemoveOverride }: Props) {
  const [showAdd, setShowAdd] = useState(false);

  const sorted = form.dateOverrides.slice().sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">Overrides</h2>
          <p className="ws-stat-note">Date-specific exceptions for the business schedule.</p>
        </div>
        <button type="button" className="appt-pilot-primary-btn" onClick={() => setShowAdd(true)}>
          Add override
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="ws-empty">
          <h3 className="ws-empty-title">No upcoming schedule changes</h3>
          <p className="ws-empty-copy">Add closures or custom hours for specific dates.</p>
        </div>
      ) : (
        <div className="ws-panel overflow-hidden">
          <table className="ws-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Scope</th>
                <th scope="col">Type</th>
                <th scope="col">Hours / status</th>
                <th scope="col" className="w-16 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>Business</td>
                  <td>{row.closed ? "Unavailable" : "Custom hours"}</td>
                  <td>{row.closed ? "All day" : formatWindowRange(row.windows || [])}</td>
                  <td className="text-right">
                    <button type="button" className="ws-icon-btn" aria-label={`Remove override ${row.date}`} onClick={() => onRemoveOverride(row.date)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAdd ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl">
            <h3 className="text-[var(--type-section)] font-semibold mb-3">Add override</h3>
            <div className="space-y-3">
              <label className="flex flex-col gap-1">
                <span className="ws-field-label">Date</span>
                <input type="date" className="input" value={form.overrideDate} onChange={(e) => onPatch({ overrideDate: e.target.value })} />
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.overrideClosed} onChange={(e) => onPatch({ overrideClosed: e.target.checked })} />
                Closed all day
              </label>
              {!form.overrideClosed ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="ws-field-label">Open</span>
                    <input type="time" className="input" value={form.overrideOpen} onChange={(e) => onPatch({ overrideOpen: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="ws-field-label">Close</span>
                    <input type="time" className="input" value={form.overrideClose} onChange={(e) => onPatch({ overrideClose: e.target.value })} />
                  </label>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="ws-secondary-btn" onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                type="button"
                className="appt-pilot-primary-btn"
                onClick={() => {
                  onAddOverride();
                  setShowAdd(false);
                }}
              >
                Save override
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {(form.blackoutDates.length > 0 || form.holidays.length > 0) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {form.blackoutDates.length > 0 ? (
            <div className="ws-panel px-4 py-3">
              <h3 className="ws-field-label mb-2">Blackout dates</h3>
              <ul className="space-y-1 text-[var(--type-list)]">
                {form.blackoutDates.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {form.holidays.length > 0 ? (
            <div className="ws-panel px-4 py-3">
              <h3 className="ws-field-label mb-2">Holiday calendar</h3>
              <ul className="space-y-1 text-[var(--type-list)]">
                {form.holidays.map((h) => (
                  <li key={h.date}>{h.date} — {h.name}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
