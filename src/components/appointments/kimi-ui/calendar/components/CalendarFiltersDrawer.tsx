"use client";

import { useEffect, useRef } from "react";

type Option = { value: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  staffOptions: Option[];
  serviceOptions: Option[];
  locationOptions: Option[];
  statusOptions: Option[];
  filters: {
    staff: string[];
    services: string[];
    locations: string[];
    statuses: string[];
  };
  onChange: (next: Props["filters"]) => void;
};

export default function CalendarFiltersDrawer({
  open,
  onClose,
  staffOptions,
  serviceOptions,
  locationOptions,
  statusOptions,
  filters,
  onChange,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggle(key: keyof Props["filters"], value: string) {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  }

  return (
    <div className="cal-filter-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={panelRef}
        className="cal-filter-drawer"
        role="dialog"
        aria-label="Calendar filters"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="cal-filter-title">Filter calendar</h2>

        <FilterGroup
          label="Staff"
          options={staffOptions}
          selected={filters.staff}
          onToggle={(v) => toggle("staff", v)}
        />
        <FilterGroup
          label="Booking types"
          options={serviceOptions}
          selected={filters.services}
          onToggle={(v) => toggle("services", v)}
        />
        <FilterGroup
          label="Locations"
          options={locationOptions}
          selected={filters.locations}
          onToggle={(v) => toggle("locations", v)}
        />
        <FilterGroup
          label="Status"
          options={statusOptions}
          selected={filters.statuses}
          onToggle={(v) => toggle("statuses", v)}
        />

        <div className="cal-filter-footer">
          <button
            type="button"
            className="btn-today"
            onClick={() =>
              onChange({ staff: [], services: [], locations: [], statuses: [] })
            }
          >
            Clear all
          </button>
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div className="cal-filter-group">
      <div className="cal-filter-label">{label}</div>
      <div className="cal-filter-options">
        {options.map((opt) => (
          <label key={opt.value} className="cal-filter-check">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={() => onToggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
