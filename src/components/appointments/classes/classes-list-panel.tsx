"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { ClassSeriesRow } from "@/lib/appointments/classes/class-form";
import { parseClassSeriesMetadata } from "@/lib/appointments/class-series-offering";

type Props = {
  classes: ClassSeriesRow[];
  selectedId: string | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
};

function nextSessionLabel(row: ClassSeriesRow): string {
  const now = Date.now();
  const upcoming = (row.occurrences || [])
    .filter((o) => o.status === "scheduled" && new Date(o.startsAt).getTime() >= now)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  if (!upcoming) return "No upcoming";
  return new Date(upcoming.startsAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * The list is the only vertical menu allowed beside the product sidebar, so it
 * is kept narrow and each row carries just enough to tell two classes apart:
 * when it next runs and how full it is. Everything else is in the workspace.
 */
export function ClassesListPanel({
  classes,
  selectedId,
  search,
  onSearch,
  onSelect,
  loading,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = classes.filter((c) => !q || c.name.toLowerCase().includes(q));

  return (
    <aside className="ws-list-panel" aria-label="Classes list">
      <div className="border-b border-[var(--border)] px-3 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">Classes</h2>
            {!loading ? <span className="ws-list-count">{classes.length}</span> : null}
          </div>
          <Link href="/appointments/classes/new" className="ws-list-new-btn">
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
            placeholder="Search classes"
            aria-label="Search classes"
            className="input has-leading-icon"
          />
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
              {q ? "No matches" : "No classes yet"}
            </p>
            <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
              {q ? `Nothing matches “${search.trim()}”.` : "Classes you create appear here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Class objects">
            {filtered.map((row) => {
              const meta = parseClassSeriesMetadata(row.metadata);
              const price = meta.isFree === false && meta.priceCents ? `$${(meta.priceCents / 100).toFixed(0)}` : "Free";
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
                      {`${nextSessionLabel(row)} · ${row.capacity} seats · ${price}`}
                    </span>
                    {row.active === false ? (
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
