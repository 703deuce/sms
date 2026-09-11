"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { DAY_LABELS } from "@/features/appointments/kimi/availability/map-availability";
import type { StaffAvailabilityRow } from "@/lib/appointments/availability/availability-workspace";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";

type Props = {
  row: StaffAvailabilityRow;
  form: AvailabilityFormState;
  services: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  onClose: () => void;
  onUseBusinessHours: () => void;
  onToggleService: (typeId: string, included: boolean) => void;
  onToggleLocation: (locationId: string, included: boolean) => void;
  onToggleDay: (day: string, open: boolean) => void;
  onUpdateWindow: (day: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (day: string) => void;
  onRemoveWindow: (day: string, index: number) => void;
};

export function AvailabilityStaffDrawer({
  row,
  form,
  services,
  locations,
  onClose,
  onUseBusinessHours,
  onToggleService,
  onToggleLocation,
  onToggleDay,
  onUpdateWindow,
  onAddWindow,
  onRemoveWindow,
}: Props) {
  const member = row.member;
  const weekly = member.weeklyHours || {};

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label={`${row.name} availability`}>
      <button type="button" className="flex-1" aria-label="Close drawer" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-[var(--type-section)] font-semibold text-[var(--text-primary)]">{row.name}</p>
            <p className="ws-stat-note">{row.sourceLabel} · {row.statusLabel}</p>
          </div>
          <button type="button" className="ws-icon-btn" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <section>
            <h3 className="ws-field-label mb-2">Availability source</h3>
            <p className="ws-stat-note mb-2">{row.sourceLabel}</p>
            <button type="button" className="ws-text-btn" onClick={onUseBusinessHours}>
              Use business default hours
            </button>
          </section>

          <section>
            <h3 className="ws-field-label mb-2">Custom weekly schedule</h3>
            <div className="space-y-2">
              {DAY_LABELS.map(({ key, label }) => {
                const windows = weekly[key] || [];
                const open = windows.length > 0;
                return (
                  <div key={key} className="rounded-md border border-[var(--border)] px-3 py-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[var(--type-list)] font-medium">{label}</span>
                      <label className="inline-flex items-center gap-2 text-[var(--type-helper)]">
                        <input type="checkbox" checked={open} onChange={(e) => onToggleDay(key, e.target.checked)} />
                        Open
                      </label>
                    </div>
                    {open ? windows.map((window, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="time" className="input w-[110px]" value={window.open} onChange={(e) => onUpdateWindow(key, idx, "open", e.target.value)} />
                        <span>—</span>
                        <input type="time" className="input w-[110px]" value={window.close} onChange={(e) => onUpdateWindow(key, idx, "close", e.target.value)} />
                        <button type="button" className="ws-icon-btn" onClick={() => onRemoveWindow(key, idx)} aria-label="Remove interval">×</button>
                      </div>
                    )) : null}
                    {open ? (
                      <button type="button" className="ws-text-btn mt-1" onClick={() => onAddWindow(key)}>Add interval</button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="ws-field-label mb-2">Assigned services</h3>
            <ul className="space-y-1">
              {services.map((service) => {
                const included = (member.appointmentTypeIds || []).includes(service.id);
                return (
                  <li key={service.id}>
                    <label className="flex items-center gap-2 text-[var(--type-list)]">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => onToggleService(service.id, included)}
                      />
                      {service.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="ws-field-label mb-2">Allowed locations</h3>
            <ul className="space-y-1">
              {locations.map((location) => {
                const included = (member.locationIds || []).includes(location.id);
                return (
                  <li key={location.id}>
                    <label className="flex items-center gap-2 text-[var(--type-list)]">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={() => onToggleLocation(location.id, included)}
                      />
                      {location.name}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="ws-field-label mb-2">Connected calendar</h3>
            <p className="ws-stat-note">{row.calendarLabel}</p>
            <Link href="/integrations/calendars" className="ws-text-btn mt-2 inline-flex">
              Manage calendars
            </Link>
          </section>
        </div>
      </aside>
    </div>
  );
}
