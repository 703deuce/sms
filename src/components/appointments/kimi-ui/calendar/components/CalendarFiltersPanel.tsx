"use client";

import { X } from "lucide-react";

type FilterOption = { id: string; name: string; color?: string };

type Props = {
  open: boolean;
  staff: FilterOption[];
  bookingTypes: FilterOption[];
  locations: FilterOption[];
  selectedStaffIds: string[];
  selectedTypeIds: string[];
  selectedLocationIds: string[];
  selectedStatuses: string[];
  onToggleStaff: (id: string) => void;
  onToggleType: (id: string) => void;
  onToggleLocation: (id: string) => void;
  onToggleStatus: (status: string) => void;
  onClearAll: () => void;
  onClose: () => void;
};

const STATUS_OPTIONS = [
  { id: "confirmed", label: "Confirmed" },
  { id: "pending", label: "Pending approval" },
  { id: "completed", label: "Completed" },
  { id: "no_show", label: "No-show" },
  { id: "canceled", label: "Canceled" },
];

export default function CalendarFiltersPanel({
  open,
  staff,
  bookingTypes,
  locations,
  selectedStaffIds,
  selectedTypeIds,
  selectedLocationIds,
  selectedStatuses,
  onToggleStaff,
  onToggleType,
  onToggleLocation,
  onToggleStatus,
  onClearAll,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="cal-filters-panel" role="dialog" aria-label="Calendar filters">
      <div className="cal-filters-head">
        <strong>Filters</strong>
        <button type="button" className="icon-btn sm" onClick={onClose} aria-label="Close filters">
          <X size={14} />
        </button>
      </div>

      <section>
        <h3>Staff</h3>
        {staff.length ? (
          staff.map((s) => (
            <label key={s.id} className="cal-filter-row">
              <input
                type="checkbox"
                checked={selectedStaffIds.includes(s.id)}
                onChange={() => onToggleStaff(s.id)}
              />
              {s.color ? <span className="legend-dot" style={{ background: s.color }} /> : null}
              {s.name}
            </label>
          ))
        ) : (
          <p className="cal-filter-empty">No staff configured</p>
        )}
      </section>

      <section>
        <h3>Booking types</h3>
        {bookingTypes.map((t) => (
          <label key={t.id} className="cal-filter-row">
            <input
              type="checkbox"
              checked={selectedTypeIds.includes(t.id)}
              onChange={() => onToggleType(t.id)}
            />
            {t.color ? <span className="legend-dot" style={{ background: t.color }} /> : null}
            {t.name}
          </label>
        ))}
      </section>

      {locations.length ? (
        <section>
          <h3>Locations</h3>
          {locations.map((l) => (
            <label key={l.id} className="cal-filter-row">
              <input
                type="checkbox"
                checked={selectedLocationIds.includes(l.id)}
                onChange={() => onToggleLocation(l.id)}
              />
              {l.name}
            </label>
          ))}
        </section>
      ) : null}

      <section>
        <h3>Status</h3>
        {STATUS_OPTIONS.map((s) => (
          <label key={s.id} className="cal-filter-row">
            <input
              type="checkbox"
              checked={selectedStatuses.includes(s.id)}
              onChange={() => onToggleStatus(s.id)}
            />
            {s.label}
          </label>
        ))}
      </section>

      <button type="button" className="btn-today" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
