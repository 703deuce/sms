"use client";

type Props = {
  open: boolean;
  workspace: {
    staff: Array<{ id: string; name: string }>;
    locations: Array<{ id: string; name: string }>;
    services: Array<{ id: string; name: string }>;
  } | null;
  filters: {
    staffId: string;
    locationId: string;
    resourceId: string;
    domainType: string;
    payment: string;
  };
  onChange: (next: Props["filters"]) => void;
  onToggle: () => void;
};

export function AppointmentsListFilters({ open, workspace, filters, onChange, onToggle }: Props) {
  if (!open) {
    return (
      <div className="tv-filter-toggle-row">
        <button type="button" className="tv-btn tv-btn--ghost tv-btn--sm" onClick={onToggle}>
          Filters
        </button>
      </div>
    );
  }

  return (
    <div className="tv-filter-bar">
      <select
        className="tv-input tv-input--sm"
        value={filters.domainType}
        onChange={(e) => onChange({ ...filters, domainType: e.target.value })}
        aria-label="Booking type"
      >
        <option value="all">All types</option>
        <option value="service">Service</option>
        <option value="meeting">Meeting</option>
        <option value="class">Class</option>
        <option value="workshop">Workshop</option>
      </select>
      <select
        className="tv-input tv-input--sm"
        value={filters.staffId}
        onChange={(e) => onChange({ ...filters, staffId: e.target.value })}
        aria-label="Staff"
      >
        <option value="">All staff</option>
        {(workspace?.staff || []).map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select
        className="tv-input tv-input--sm"
        value={filters.locationId}
        onChange={(e) => onChange({ ...filters, locationId: e.target.value })}
        aria-label="Location"
      >
        <option value="">All locations</option>
        {(workspace?.locations || []).map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <select
        className="tv-input tv-input--sm"
        value={filters.payment}
        onChange={(e) => onChange({ ...filters, payment: e.target.value })}
        aria-label="Payment"
      >
        <option value="">All payments</option>
        <option value="due">Balance due</option>
      </select>
      <button type="button" className="tv-btn tv-btn--ghost tv-btn--sm" onClick={onToggle}>
        Hide filters
      </button>
    </div>
  );
}
