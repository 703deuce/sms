import { useMemo, useState } from "react";
import type { Slot } from "../mock-data";
import {
  formatDayShort,
  formatTime,
  timezoneAbbrev,
} from "./ui";

export function SlotPicker({
  slots,
  timezone,
  selected,
  onSelect,
}: {
  slots: Slot[];
  timezone?: string | null;
  selected: string;
  onSelect: (startsAt: string) => void;
}) {
  const days = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = new Date(slot.startsAt).toDateString();
      const arr = map.get(key) ?? [];
      arr.push(slot);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([key, daySlots]) => ({
      key,
      label: formatDayShort(daySlots[0].startsAt, timezone),
      slots: daySlots,
    }));
  }, [slots, timezone]);

  const [activeDay, setActiveDay] = useState("");
  const current =
    days.find((d) => d.key === activeDay) ?? days[0];

  if (days.length === 0) {
    return (
      <div
        style={{
          borderRadius: "var(--radius-md)",
          background: "var(--surface-subtle)",
          border: "1px dashed var(--border-strong)",
          padding: "20px 16px",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: "var(--text-secondary)" }}>
          No available times right now
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.55, color: "var(--text-muted)" }}>
          Contact the business to find another time for your appointment.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Choose a day"
        style={{
          display: "flex",
          gap: 6,
          overflowX: "auto",
          paddingBottom: 4,
          marginBottom: 12,
        }}
      >
        {days.map((day) => {
          const active = day.key === current?.key;
          return (
            <button
              key={day.key}
              role="tab"
              aria-selected={active}
              onClick={() => setActiveDay(day.key)}
              style={{
                flexShrink: 0,
                height: 34,
                padding: "0 13px",
                borderRadius: 999,
                border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                background: active ? "var(--accent-soft)" : "var(--surface)",
                color: active ? "var(--accent)" : "var(--text-secondary)",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 120ms ease",
              }}
            >
              {day.label}
            </button>
          );
        })}
      </div>

      <div
        role="radiogroup"
        aria-label="Available times"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))",
          gap: 8,
        }}
      >
        {current?.slots.map((slot) => {
          const isSelected = selected === slot.startsAt;
          return (
            <button
              key={slot.startsAt}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onSelect(slot.startsAt)}
              style={{
                height: 42,
                borderRadius: "var(--radius-sm)",
                border: `1.5px solid ${isSelected ? "var(--accent)" : "var(--border-strong)"}`,
                background: isSelected ? "var(--accent)" : "var(--surface)",
                color: isSelected ? "#fff" : "var(--text-primary)",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: isSelected
                  ? `0 0 0 3px var(--accent-ring)`
                  : "0 1px 2px rgba(16,24,40,0.04)",
                transition: "all 120ms ease",
              }}
            >
              {formatTime(slot.startsAt, timezone)}
            </button>
          );
        })}
      </div>

      {timezone ? (
        <p
          style={{
            margin: "10px 2px 0",
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          Times shown in {timezoneAbbrev(timezone)} ({timezone})
        </p>
      ) : null}
    </div>
  );
}
