"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { WorkshopSeriesRow } from "@/lib/appointments/workshops/workshop-form";
import { parseClassSeriesMetadata } from "@/lib/appointments/class-series-offering";
import { formatSessionSpan, upcomingSessions } from "@/lib/appointments/workshops/workshop-schedule";

export type WorkshopListFilter = "all" | "upcoming" | "past" | "inactive";

export const WORKSHOP_FILTERS: Array<{ id: WorkshopListFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "inactive", label: "Inactive" },
];

type Props = {
  workshops: WorkshopSeriesRow[];
  selectedId: string | null;
  search: string;
  filter: WorkshopListFilter;
  onSearch: (q: string) => void;
  onFilter: (f: WorkshopListFilter) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
};

function matchesFilter(row: WorkshopSeriesRow, filter: WorkshopListFilter): boolean {
  if (filter === "all") return true;
  if (filter === "inactive") return row.active === false;
  const hasUpcoming = upcomingSessions(row.occurrences || []).length > 0;
  if (filter === "upcoming") return row.active !== false && hasUpcoming;
  return !hasUpcoming;
}

/**
 * The only vertical menu allowed beside the product sidebar, so it stays
 * narrow. A workshop is identified by its date far more than by anything else,
 * so the date leads each row and the rest of the detail lives in the workspace.
 */
export function WorkshopsListPanel({
  workshops,
  selectedId,
  search,
  filter,
  onSearch,
  onFilter,
  onSelect,
  loading,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = workshops.filter(
    (w) => (!q || w.name.toLowerCase().includes(q)) && matchesFilter(w, filter),
  );

  return (
    <aside className="ws-list-panel" aria-label="Workshops list">
      <div className="border-b border-[var(--border)] px-3 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">Workshops</h2>
            {!loading ? <span className="ws-list-count">{workshops.length}</span> : null}
          </div>
          <Link href="/appointments/workshops/new" className="ws-list-new-btn">
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
            placeholder="Search workshops"
            aria-label="Search workshops"
            className="input has-leading-icon"
          />
        </div>

        <div className="ws-list-filters" role="tablist" aria-label="Filter workshops">
          {WORKSHOP_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              className="ws-list-filter"
              onClick={() => onFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
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
              {q || filter !== "all" ? "No matches" : "No workshops yet"}
            </p>
            <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
              {q
                ? `Nothing matches “${search.trim()}”.`
                : filter !== "all"
                  ? "Try a different filter."
                  : "Workshops you create appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Workshop objects">
            {filtered.map((row) => {
              const meta = parseClassSeriesMetadata(row.metadata);
              const price =
                meta.isFree === false && meta.priceCents
                  ? `$${(meta.priceCents / 100).toFixed(0)}`
                  : "Free";
              const registered = Number(row.registeredCount ?? 0);
              return (
                <li key={row.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selectedId === row.id}
                    onClick={() => onSelect(row.id)}
                    className="ws-list-item"
                  >
                    <span className="ws-list-item-name">{row.name}</span>
                    <span className="ws-list-item-meta">
                      {`${formatSessionSpan(row.occurrences || [])} · ${registered}/${row.capacity} · ${price}`}
                    </span>
                    {meta.cancelledAt ? (
                      <span className="ws-chip ws-chip-warning mt-1.5">Cancelled</span>
                    ) : row.active === false ? (
                      <span className="ws-chip ws-chip-neutral mt-1.5">Inactive</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
