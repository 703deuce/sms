"use client";

import { SchedulingRulesSection } from "@/features/appointments/kimi/availability/SchedulingRulesSection";
import type { AvailabilityFormState } from "@/features/appointments/kimi/availability/types";

type Props = {
  form: AvailabilityFormState;
  onPatch: (patch: Partial<AvailabilityFormState>) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
};

export function AvailabilityBookingRulesSection({ form, onPatch, onSave, saving, saved }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="ws-panel px-4 py-4 lg:col-span-1">
        <h2 className="ws-field-label mb-3">Minimum notice</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input w-24"
            min={0}
            value={form.minimumNotice}
            onChange={(e) => onPatch({ minimumNotice: Number(e.target.value) || 0 })}
          />
          <span className="ws-stat-note">minutes before start</span>
        </div>
      </div>
      <div className="ws-panel px-4 py-4 lg:col-span-1">
        <h2 className="ws-field-label mb-3">Booking horizon</h2>
        <div className="flex items-center gap-2">
          <input
            type="number"
            className="input w-24"
            min={1}
            value={form.maximumDays}
            onChange={(e) => onPatch({ maximumDays: Number(e.target.value) || 1 })}
          />
          <span className="ws-stat-note">days in advance</span>
        </div>
      </div>
      <div className="ws-panel px-4 py-4 lg:col-span-1">
        <h2 className="ws-field-label mb-3">Workspace booking limits</h2>
        <div className="grid gap-2">
          <input type="number" className="input" placeholder="Max per day" min={0} value={form.maxBookingsPerDay ?? ""} onChange={(e) => onPatch({ maxBookingsPerDay: e.target.value ? Number(e.target.value) : undefined })} />
          <input type="number" className="input" placeholder="Max per week" min={0} value={form.maxBookingsPerWeek ?? ""} onChange={(e) => onPatch({ maxBookingsPerWeek: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
      <div className="lg:col-span-3">
        <SchedulingRulesSection form={form} onPatch={onPatch} onSave={onSave} saving={saving} saved={saved} />
      </div>
    </div>
  );
}
