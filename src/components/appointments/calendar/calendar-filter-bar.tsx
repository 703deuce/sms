"use client";

import { Search } from "lucide-react";

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
};

type Props = {
  workspace: Workspace | null;
  filters: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function CalendarFilterBar({ workspace, filters, onChange, collapsed }: Props) {
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
        onChange={(e) =>
          onChange({ ...filters, staffIds: e.target.value ? [e.target.value] : [] })
        }
        aria-label="Staff filter"
      >
        <option value="">All staff</option>
        {(workspace?.staff || []).map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select
        className="rounded border border-[var(--border)] px-2 py-1.5 max-w-[140px]"
        value={filters.locationId}
        onChange={(e) => onChange({ ...filters, locationId: e.target.value })}
        aria-label="Location filter"
      >
        <option value="">All locations</option>
        {(workspace?.locations || []).map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <select
        className="rounded border border-[var(--border)] px-2 py-1.5 max-w-[140px]"
        value={filters.resourceId}
        onChange={(e) => onChange({ ...filters, resourceId: e.target.value })}
        aria-label="Resource filter"
      >
        <option value="">All resources</option>
        {(workspace?.resources || []).map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <select
        className="rounded border border-[var(--border)] px-2 py-1.5"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
        aria-label="Status filter"
      >
        <option value="all">All statuses</option>
        <option value="confirmed">Confirmed</option>
        <option value="awaiting_confirmation">Pending</option>
        <option value="completed">Completed</option>
        <option value="canceled">Cancelled</option>
      </select>
    </div>
  );
}
