"use client";

import { CalendarClock, ChevronDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { Slot } from "../types";

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SlotPicker({
  slots,
  loading,
  selected,
  onSelect,
  error,
}: {
  slots: Slot[];
  loading: boolean;
  selected: string;
  onSelect: (startsAt: string) => void;
  error?: string;
}) {
  const [showAll, setShowAll] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const k = dayKey(s.startsAt);
      const arr = map.get(k) || [];
      arr.push(s);
      map.set(k, arr);
    }
    return Array.from(map.entries());
  }, [slots]);

  const visible = showAll ? grouped : grouped.slice(0, 3);

  if (loading) {
    return (
      <div className="rounded-[10px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-6">
        <div className="flex items-center gap-2 text-[13px] text-[hsl(var(--muted-foreground))]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading available times…
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="tv-skel h-9" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[10px] border border-[hsl(var(--danger)/0.3)] bg-[hsl(var(--danger)/0.05)] px-4 py-4">
        <p className="text-[13px] font-medium text-[hsl(var(--danger))]">{error}</p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Check your connection and try again, or contact support if the problem continues.
        </p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.3)] px-4 py-8 text-center">
        <CalendarClock className="mx-auto h-6 w-6 text-[hsl(var(--muted-foreground)/0.6)]" />
        <p className="mt-2 text-[13px] font-semibold text-[hsl(var(--foreground))]">
          No open times in the next 14 days
        </p>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Try a different appointment type, or adjust availability under Booking → Availability.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map(([key, daySlots]) => (
        <div key={key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            {dayLabel(daySlots[0].startsAt)}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {daySlots.map((s) => {
              const active = selected === s.startsAt;
              return (
                <button
                  key={s.startsAt}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(s.startsAt)}
                  className="tv-slot h-9 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[13px] font-semibold tabular-nums text-[hsl(var(--foreground))]"
                >
                  {timeLabel(s.startsAt)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {grouped.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[hsl(var(--primary))] hover:underline"
        >
          {showAll ? "Show fewer days" : `Show ${grouped.length - 3} more days`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}
