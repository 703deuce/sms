"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type PublicDayTimeSlot = { startsAt: string; endsAt?: string };

function dayKeyInTimezone(iso: string, timezone?: string | null): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value || "0000";
  const m = parts.find((p) => p.type === "month")?.value || "01";
  const d = parts.find((p) => p.type === "day")?.value || "01";
  return `${y}-${m}-${d}`;
}

function formatDayChip(iso: string, timezone?: string | null) {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString(undefined, {
      weekday: "short",
      timeZone: timezone || undefined,
    }),
    dayNum: d.toLocaleDateString(undefined, {
      day: "numeric",
      timeZone: timezone || undefined,
    }),
    heading: d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: timezone || undefined,
    }),
  };
}

function formatTime(iso: string, timezone?: string | null): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone || undefined,
  });
}

export function PublicDayTimeSlotPicker({
  slots,
  timezone,
  selectedStartsAt,
  onSelectStartsAt,
  daysPerPage = 6,
}: {
  slots: PublicDayTimeSlot[];
  timezone?: string | null;
  selectedStartsAt: string;
  onSelectStartsAt: (startsAt: string) => void;
  daysPerPage?: number;
}) {
  const byDay = useMemo(() => {
    const map = new Map<string, PublicDayTimeSlot[]>();
    for (const slot of slots) {
      const key = dayKeyInTimezone(slot.startsAt, timezone);
      const list = map.get(key) || [];
      list.push(slot);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots, timezone]);

  const [selectedDayKey, setSelectedDayKey] = useState("");
  const [dayPage, setDayPage] = useState(0);

  useEffect(() => {
    if (!byDay.length) {
      setSelectedDayKey("");
      return;
    }
    const stillValid = byDay.some(([k]) => k === selectedDayKey);
    if (!stillValid) {
      const match = selectedStartsAt
        ? byDay.find(([k]) => k === dayKeyInTimezone(selectedStartsAt, timezone))?.[0]
        : null;
      setSelectedDayKey(match || byDay[0][0]);
      setDayPage(0);
    }
  }, [byDay, selectedDayKey, selectedStartsAt, timezone]);

  const pageStart = dayPage * daysPerPage;
  const visibleDays = byDay.slice(pageStart, pageStart + daysPerPage);
  const canPrev = dayPage > 0;
  const canNext = pageStart + daysPerPage < byDay.length;

  const daySlots =
    byDay.find(([k]) => k === selectedDayKey)?.[1] ||
    (visibleDays[0] ? visibleDays[0][1] : []);

  const chipSampleIso = daySlots[0]?.startsAt || byDay.find(([k]) => k === selectedDayKey)?.[1][0]?.startsAt;

  if (!slots.length) {
    return (
      <p className="mt-4 text-sm text-muted-foreground" role="status">
        No open times are available right now. Please contact the business.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Select a date
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous dates"
            disabled={!canPrev}
            onClick={() => setDayPage((p) => Math.max(0, p - 1))}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next dates"
            disabled={!canNext}
            onClick={() => setDayPage((p) => p + 1)}
            className="flex size-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {visibleDays.map(([key, daySlotList]) => {
          const sample = daySlotList[0];
          const chip = formatDayChip(sample.startsAt, timezone);
          const active = key === selectedDayKey;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSelectedDayKey(key);
                onSelectStartsAt("");
              }}
              className={cn(
                "flex flex-col items-center rounded-lg border px-2 py-2 transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary/40",
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {chip.weekday}
              </span>
              <span className="text-base font-bold leading-tight">{chip.dayNum}</span>
              <span
                className={cn(
                  "text-[10px]",
                  active ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {daySlotList.length} open
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Globe2 className="size-3.5 shrink-0" aria-hidden />
        Times in {(timezone || "local").replace(/_/g, " ")}
      </p>

      {chipSampleIso ? (
        <p className="mt-3 text-sm font-semibold text-foreground">
          Available times · {formatDayChip(chipSampleIso, timezone).heading}
        </p>
      ) : null}

      <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" aria-label="Available times">
        {daySlots.map((s) => {
          const active = selectedStartsAt === s.startsAt;
          return (
            <li key={s.startsAt}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelectStartsAt(s.startsAt)}
                className={cn(
                  "w-full rounded-lg border px-2 py-2.5 text-sm font-medium tabular-nums transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                {formatTime(s.startsAt, timezone)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
