"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import type { ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import {
  serviceDurationSummary,
  serviceIsActive,
  serviceLocationSummary,
  servicePriceLabel,
  serviceStaffSummary,
} from "@/lib/appointments/services/service-display";

type Props = {
  services: ApiTypeRow[];
  selectedId: string | null;
  search: string;
  categoryId: string;
  categoryOptions: Array<{ id: string; name: string }>;
  staffNames: Map<string, string>;
  locationNames: Map<string, string>;
  onSearch: (q: string) => void;
  onCategory: (id: string) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
};

/** Second line of a row: the facts an operator scans for, not every setting. */
function rowMeta(
  row: ApiTypeRow,
  staffNames: Map<string, string>,
  locationNames: Map<string, string>,
): string {
  const parts = [serviceDurationSummary(row), servicePriceLabel(row.config)];
  const staffIds =
    row.config?.staffAssignment === "collective"
      ? row.config?.collectiveStaffIds || []
      : row.config?.staffIds || [];
  if (staffIds.length > 1) parts.push(`${staffIds.length} staff`);
  else if (staffIds.length === 1) parts.push(serviceStaffSummary(row.config, staffNames));
  const locations = row.config?.locationIds || [];
  if (locations.length > 1) parts.push(`${locations.length} locations`);
  else if (locations.length === 1) parts.push(serviceLocationSummary(row.config, locationNames));
  return parts.join(" · ");
}

export function ServicesListPanel({
  services,
  selectedId,
  search,
  categoryId,
  categoryOptions,
  staffNames,
  locationNames,
  onSearch,
  onCategory,
  onSelect,
  loading,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = services.filter((s) => {
    if (q && !s.name.toLowerCase().includes(q)) return false;
    if (categoryId && s.config?.categoryId !== categoryId) return false;
    return true;
  });

  return (
    <aside className="ws-list-panel" aria-label="Services list">
      <div className="border-b border-[var(--border)] px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">Services</h2>
            {!loading ? <span className="ws-list-count">{services.length}</span> : null}
          </div>
          <Link href="/appointments/services/new" className="ws-list-new-btn">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Link>
        </div>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-tertiary)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search services"
            aria-label="Search services"
            className="input has-leading-icon"
          />
        </div>
        {categoryOptions.length > 0 ? (
          <select
            className="input mt-2"
            value={categoryId}
            aria-label="Filter by category"
            onChange={(e) => onCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="animate-pulse space-y-2 p-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-[var(--surface-muted)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[var(--type-list)] font-medium text-[var(--text-primary)]">
              {q || categoryId ? "No matches" : "No services yet"}
            </p>
            <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
              {q
                ? `Nothing matches “${search.trim()}”.`
                : categoryId
                  ? "No services in this category."
                  : "Create a service customers can schedule with your business."}
            </p>
            {!q && !categoryId ? (
              <Link href="/appointments/services/new" className="ws-list-new-btn mt-4 inline-flex">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create service
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Service objects">
            {filtered.map((s) => (
              <li key={s.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedId === s.id}
                  onClick={() => onSelect(s.id)}
                  className="ws-list-item"
                >
                  <span className="ws-list-item-name">{s.name}</span>
                  <span className="ws-list-item-meta">
                    {rowMeta(s, staffNames, locationNames)}
                  </span>
                  {!serviceIsActive(s) ? (
                    <span className="ws-chip ws-chip-neutral mt-1.5">Inactive</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
