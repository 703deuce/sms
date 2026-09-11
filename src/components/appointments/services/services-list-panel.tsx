"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import type { ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import {
  serviceDurationSummary,
  serviceIsActive,
  servicePriceLabel,
} from "@/lib/appointments/services/service-display";

type Props = {
  services: ApiTypeRow[];
  selectedId: string | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
};

export function ServicesListPanel({
  services,
  selectedId,
  search,
  onSearch,
  onSelect,
  loading,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = services.filter((s) => !q || s.name.toLowerCase().includes(q));

  return (
    <aside className="ws-list-panel" aria-label="Services list">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Services</h2>
          <Link href="/appointments/services/new" className="ws-list-new-btn">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Link>
        </div>
        <div className="relative mt-3">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search services"
            aria-label="Search services"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] py-2 pl-8 pr-3 text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--brand-accent)] focus:ring-2 focus:ring-[var(--brand-accent)]/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="space-y-2 p-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-[var(--surface-muted)]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">No services yet</p>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Create a service customers can book online.
            </p>
            <Link href="/appointments/services/new" className="ws-list-new-btn mt-4 inline-flex">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Create service
            </Link>
          </div>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Service objects">
            {filtered.map((s) => {
              const active = selectedId === s.id;
              const duration = serviceDurationSummary(s);
              const price = servicePriceLabel(s.config);
              const isActive = serviceIsActive(s);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(s.id)}
                    className="ws-list-item"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{s.name}</p>
                      {!isActive ? (
                        <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                      {duration} · {price}
                    </p>
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
