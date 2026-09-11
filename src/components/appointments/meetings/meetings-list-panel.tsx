"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import type { ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import {
  formatDurationMinutes,
  meetingIsActive,
  meetingMethodLabel,
} from "@/lib/appointments/meetings/meeting-display";

type Props = {
  meetings: ApiTypeRow[];
  selectedId: string | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
};

export function MeetingsListPanel({
  meetings,
  selectedId,
  search,
  onSearch,
  onSelect,
  loading,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = meetings.filter((m) => !q || m.name.toLowerCase().includes(q));

  return (
    <aside className="ws-list-panel" aria-label="Meetings list">
      <div className="border-b border-[var(--border)] px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Meetings</h2>
          <Link href="/appointments/meetings/new" className="ws-list-new-btn">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New
          </Link>
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search meetings"
            aria-label="Search meetings"
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
            <p className="text-[13px] font-medium text-[var(--text-primary)]">No meetings yet</p>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Create a meeting customers can book online.
            </p>
            <Link href="/appointments/meetings/new" className="ws-list-new-btn mt-4 inline-flex">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Create meeting
            </Link>
          </div>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Meeting objects">
            {filtered.map((m) => {
              const active = selectedId === m.id;
              const duration = formatDurationMinutes(m.durationMinutes ?? 30);
              const method = meetingMethodLabel(m.config);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(m.id)}
                    className="ws-list-item"
                  >
                    <p className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{m.name}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary)]">
                      {duration} · {method}
                    </p>
                    {!meetingIsActive(m) ? (
                      <span className="mt-1 inline-block rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                        Inactive
                      </span>
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
