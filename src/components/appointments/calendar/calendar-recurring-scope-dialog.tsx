"use client";

import type { RecurringEditScope } from "@/lib/appointments/service-booking/types";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (scope: RecurringEditScope) => void;
};

export function CalendarRecurringScopeDialog({ open, onClose, onConfirm }: Props) {
  if (!open) return null;
  return (
    <div className="cal-drawer-backdrop z-[60]" role="presentation" onClick={onClose}>
      <div
        className="mx-auto mt-[20vh] max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg"
        role="dialog"
        aria-label="Recurring appointment scope"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold">Apply this change to</h3>
        <p className="mt-1 text-xs text-[var(--muted)]">
          This appointment is part of a recurring series.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="appt-pilot-primary-btn w-full"
            onClick={() => onConfirm("this_only")}
          >
            This appointment
          </button>
          <button
            type="button"
            className="appt-pilot-secondary-btn w-full"
            onClick={() => onConfirm("this_and_future")}
          >
            This and future appointments
          </button>
          <button
            type="button"
            className="appt-pilot-secondary-btn w-full"
            onClick={() => onConfirm("entire_series")}
          >
            Entire series
          </button>
          <button type="button" className="text-xs text-[var(--muted)] underline" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
