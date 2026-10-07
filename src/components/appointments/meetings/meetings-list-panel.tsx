"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import type { ApiTypeRow } from "@/lib/appointments/booking-types-segments";
import {
  formatDurationMinutes,
  meetingIsActive,
  meetingMethodLabel,
} from "@/lib/appointments/meetings/meeting-display";
import {
  APPOINTMENTS_MEETINGS_ROUTES,
  type MeetingsWorkspaceRoutes,
} from "@/lib/appointments/bookable-workspace-routes";

type Props = {
  meetings: ApiTypeRow[];
  selectedId: string | null;
  search: string;
  onSearch: (q: string) => void;
  onSelect: (id: string) => void;
  loading?: boolean;
  routes?: MeetingsWorkspaceRoutes;
};

export function MeetingsListPanel({
  meetings,
  selectedId,
  search,
  onSearch,
  onSelect,
  loading,
  routes = APPOINTMENTS_MEETINGS_ROUTES,
}: Props) {
  const q = search.trim().toLowerCase();
  const filtered = meetings.filter((m) => !q || m.name.toLowerCase().includes(q));

  return (
    <aside className="ws-list-panel" aria-label="Meetings list">
      <div className="border-b border-[var(--border)] px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[0.9375rem] font-semibold text-[var(--text-primary)]">Meetings</h2>
            {!loading ? <span className="ws-list-count">{meetings.length}</span> : null}
          </div>
          <Link href={routes.new} className="ws-list-new-btn">
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
            placeholder="Search meetings"
            aria-label="Search meetings"
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
              {q ? "No matches" : "No meetings yet"}
            </p>
            <p className="mt-1 text-[var(--type-helper)] text-[var(--text-secondary)]">
              {q ? `Nothing matches “${search.trim()}”.` : "Create a meeting customers can book online."}
            </p>
            {!q ? (
              <Link href={routes.new} className="ws-list-new-btn mt-4 inline-flex">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create meeting
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="space-y-1" role="listbox" aria-label="Meeting objects">
            {filtered.map((m) => {
              const active = selectedId === m.id;
              const duration = formatDurationMinutes(m.durationMinutes ?? 30);
              const method = meetingMethodLabel(m.config);
              const inactive = !meetingIsActive(m);
              return (
                <li key={m.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(m.id)}
                    className="ws-list-item"
                  >
                    <span className="ws-list-item-name">{m.name}</span>
                    <span className="ws-list-item-meta">
                      {duration} · {method === "Not set" ? "Method not set" : method}
                    </span>
                    {inactive ? (
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
