"use client";

import { useRef, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

export type CalendarFilters = {
  q: string;
  staffIds: string[];
  locationId: string;
  resourceId: string;
  status: string;
  domainType: string;
};

type Workspace = {
  staff: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  resources: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string }>;
  timezone?: string;
};

type Props = {
  workspace: Workspace | null;
  filters: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
  collapsed?: boolean;
  onSearchSubmit?: () => void;
  onWaitlist?: () => void;
  onAdd?: () => void;
  secondaryFiltersOpen?: boolean;
  onToggleSecondaryFilters?: () => void;
  showSecondary?: boolean;
};

function activeSecondaryCount(filters: CalendarFilters) {
  let n = 0;
  if (filters.locationId) n += 1;
  if (filters.resourceId) n += 1;
  if (filters.status !== "all") n += 1;
  return n;
}

export function CalendarFilterBar({
  workspace,
  filters,
  onChange,
  collapsed,
  onSearchSubmit,
  onWaitlist,
  onAdd,
  secondaryFiltersOpen,
  onToggleSecondaryFilters,
}: Props) {
  const popRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const secondaryCount = activeSecondaryCount(filters);

  if (collapsed) return null;

  return (
    <div className="cal-filter-bar flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs lg:px-6">
      <div className="relative min-w-[160px] flex-1 max-w-xs">
        <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-[var(--text-muted)]" />
        <input
          className="w-full rounded-md border border-[var(--border)] py-1.5 pl-7 pr-2"
          placeholder="Search client, service…"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearchSubmit?.();
          }}
          aria-label="Search calendar"
        />
      </div>
      <select
        className="rounded border border-[var(--border)] px-2 py-1.5"
        value={filters.domainType}
        onChange={(e) => onChange({ ...filters, domainType: e.target.value })}
        aria-label="Booking type"
      >
        <option value="all">All types</option>
        <option value="service">Services</option>
        <option value="meeting">Meetings</option>
        <option value="class">Classes</option>
        <option value="workshop">Workshops</option>
      </select>
      <select
        className="rounded border border-[var(--border)] px-2 py-1.5 max-w-[140px]"
        value={filters.staffIds[0] || ""}
        onChange={(e) => onChange({ ...filters, staffIds: e.target.value ? [e.target.value] : [] })}
        aria-label="Staff filter"
      >
        <option value="">All staff</option>
        {(workspace?.staff || []).map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <div className="relative" ref={popRef}>
        <button
          type="button"
          className="appt-pilot-secondary-btn inline-flex items-center gap-1"
          onClick={() => {
            setOpen((v) => !v);
            onToggleSecondaryFilters?.();
          }}
          aria-expanded={open || secondaryFiltersOpen}
        >
          <SlidersHorizontal size={14} aria-hidden />
          Filters
          {secondaryCount > 0 ? <span className="cal-filter-count">{secondaryCount}</span> : null}
        </button>
        {open || secondaryFiltersOpen ? (
          <div className="cal-filter-popover">
            <label className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">Location</span>
              <select
                className="rounded border border-[var(--border)] px-2 py-1.5"
                value={filters.locationId}
                onChange={(e) => onChange({ ...filters, locationId: e.target.value })}
              >
                <option value="">All locations</option>
                {(workspace?.locations || []).map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">Resource</span>
              <select
                className="rounded border border-[var(--border)] px-2 py-1.5"
                value={filters.resourceId}
                onChange={(e) => onChange({ ...filters, resourceId: e.target.value })}
              >
                <option value="">All resources</option>
                {(workspace?.resources || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[var(--muted)]">Status</span>
              <select
                className="rounded border border-[var(--border)] px-2 py-1.5"
                value={filters.status}
                onChange={(e) => onChange({ ...filters, status: e.target.value })}
              >
                <option value="all">All statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="awaiting_confirmation">Pending</option>
                <option value="completed">Completed</option>
                <option value="canceled">Cancelled</option>
              </select>
            </label>
          </div>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        {onWaitlist ? (
          <button type="button" className="appt-pilot-secondary-btn" onClick={onWaitlist}>
            Waitlist
          </button>
        ) : null}
        {onAdd ? (
          <button type="button" className="appt-pilot-primary-btn" onClick={onAdd}>
            + Add
          </button>
        ) : null}
      </div>
    </div>
  );
}
