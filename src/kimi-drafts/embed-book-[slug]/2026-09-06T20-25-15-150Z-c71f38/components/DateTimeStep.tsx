"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import {
  formatSlotTime,
  type BookingType,
  type LocationOption,
  type Slot,
  type StaffOption,
} from "../mock-data";

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

const RECURRING_OPTIONS = [
  { value: "once", label: "Does not repeat" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly", label: "Monthly" },
] as const;

export default function DateTimeStep({
  type,
  staff,
  locations,
  selectedStaffId,
  selectedLocationId,
  durationMinutes,
  onDurationChange,
  recurringMode,
  recurringOccurrences,
  onRecurringChange,
  onStaffChange,
  onLocationChange,
  slotsForDate,
  onPickSlot,
  onBack,
  onWaitlist,
}: {
  type: BookingType;
  staff: StaffOption[];
  locations: LocationOption[];
  selectedStaffId: string;
  selectedLocationId: string;
  durationMinutes: number | null;
  onDurationChange: (minutes: number) => void;
  recurringMode: "once" | "weekly" | "biweekly" | "monthly";
  recurringOccurrences: number;
  onRecurringChange: (
    mode: "once" | "weekly" | "biweekly" | "monthly",
    occurrences: number,
  ) => void;
  onStaffChange: (id: string) => void;
  onLocationChange: (id: string) => void;
  slotsForDate: (dateKey: string, duration: number) => Slot[];
  onPickSlot: (slot: Slot) => void;
  onBack: () => void;
  onWaitlist: () => void;
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [monthCursor, setMonthCursor] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const showStaff = type.config?.staffAssignment === "customer_choice";
  const showLocations = locations.length > 0;
  const durationOptions = type.config?.durationOptions;
  const recurring = type.config?.recurring;
  const effectiveDuration = durationMinutes ?? type.durationMinutes;

  const days = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const first = new Date(year, month, 1);
    const startPad = first.getDay();
    const count = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ key: string; day: number; disabled: boolean; today: boolean } | null> = [];
    for (let i = 0; i < startPad; i++) cells.push(null);
    for (let d = 1; d <= count; d++) {
      const date = new Date(year, month, d);
      const key = toKey(date);
      cells.push({
        key,
        day: d,
        disabled: date < today,
        today: toKey(date) === toKey(new Date()),
      });
    }
    return cells;
  }, [monthCursor, today]);

  const slots = selectedDate ? slotsForDate(selectedDate, effectiveDuration) : [];

  return (
    <div>
      <h1 className="eb-title">{type.name}</h1>
      <p className="eb-sub">
        Select a date and time that works for you · {effectiveDuration} minutes
      </p>

      {durationOptions && durationOptions.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <span className="eb-field-label" id="eb-duration-label">Session length</span>
          <div className="eb-chip-row" role="radiogroup" aria-labelledby="eb-duration-label">
            {durationOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={effectiveDuration === opt.minutes}
                className={`eb-chip${effectiveDuration === opt.minutes ? " eb-chip--active" : ""}`}
                onClick={() => onDurationChange(opt.minutes)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {(showStaff || showLocations) && (
        <div className="eb-datetime">
          {showStaff && (
            <div>
              <label className="eb-field-label" htmlFor="eb-staff">Staff member</label>
              <select
                id="eb-staff"
                className="eb-select"
                value={selectedStaffId}
                onChange={(e) => onStaffChange(e.target.value)}
              >
                <option value="">No preference</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          {showLocations && (
            <div>
              <label className="eb-field-label" htmlFor="eb-location">Location</label>
              <select
                id="eb-location"
                className="eb-select"
                value={selectedLocationId}
                onChange={(e) => onLocationChange(e.target.value)}
              >
                <option value="">Select a location…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.kind}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {recurring?.enabled && (
        <div className="eb-recurring">
          <div className="eb-recurring__head">
            <Repeat size={13} aria-hidden /> Make this a recurring appointment?
          </div>
          <div className="eb-recurring__grid">
            <div>
              <label className="eb-field-label" htmlFor="eb-rec-mode">Repeats</label>
              <select
                id="eb-rec-mode"
                className="eb-select"
                value={recurringMode}
                onChange={(e) =>
                  onRecurringChange(
                    e.target.value as typeof recurringMode,
                    recurringOccurrences,
                  )
                }
              >
                {RECURRING_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {recurringMode !== "once" && (
              <div>
                <label className="eb-field-label" htmlFor="eb-rec-count">Number of sessions</label>
                <select
                  id="eb-rec-count"
                  className="eb-select"
                  value={recurringOccurrences}
                  onChange={(e) => onRecurringChange(recurringMode, Number(e.target.value))}
                >
                  {Array.from({ length: recurring.maxOccurrences - 1 }, (_, i) => i + 2).map(
                    (n) => (
                      <option key={n} value={n}>{n} sessions</option>
                    ),
                  )}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="eb-picker">
        <div className="eb-cal" role="group" aria-label="Choose a date">
          <div className="eb-cal__head">
            <button
              type="button"
              className="eb-cal__nav"
              aria-label="Previous month"
              onClick={() =>
                setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))
              }
            >
              <ChevronLeft size={14} aria-hidden />
            </button>
            <span className="eb-cal__month">
              {monthCursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              className="eb-cal__nav"
              aria-label="Next month"
              onClick={() =>
                setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))
              }
            >
              <ChevronRight size={14} aria-hidden />
            </button>
          </div>
          <div className="eb-cal__grid">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <span key={d} className="eb-cal__dow">{d}</span>
            ))}
            {days.map((cell, i) =>
              cell ? (
                <button
                  key={cell.key}
                  type="button"
                  className={`eb-cal__day${cell.today ? " eb-cal__day--today" : ""}${
                    selectedDate === cell.key ? " eb-cal__day--selected" : ""
                  }`}
                  disabled={cell.disabled}
                  aria-pressed={selectedDate === cell.key}
                  onClick={() => setSelectedDate(cell.key)}
                >
                  {cell.day}
                </button>
              ) : (
                <span key={`pad-${i}`} aria-hidden />
              ),
            )}
          </div>
        </div>

        <div>
          <div className="eb-slots__label">
            <CalendarDays size={14} aria-hidden />
            {selectedDate
              ? new Date(`${selectedDate}T12:00:00`).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })
              : "Available times"}
            <span className="eb-slots__tz">Eastern Time</span>
          </div>
          {!selectedDate ? (
            <div className="eb-slots-empty">
              <span>Select a date to see available times.</span>
            </div>
          ) : slots.length === 0 ? (
            <div className="eb-slots-empty">
              <span>No times available on this date.</span>
              <button type="button" className="eb-btn eb-btn--outline eb-btn--sm" onClick={onWaitlist}>
                Join waitlist
              </button>
            </div>
          ) : (
            <div className="eb-slots" role="list">
              {slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  role="listitem"
                  className="eb-slot"
                  onClick={() => onPickSlot(slot)}
                >
                  {formatSlotTime(slot.startsAt)}
                  {slot.remaining !== undefined && slot.capacity !== undefined ? (
                    <span className="eb-slot__cap">{slot.remaining} left</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
          {selectedDate && slots.length > 0 ? (
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <button type="button" className="eb-btn eb-btn--ghost eb-btn--sm" onClick={onWaitlist}>
                None of these work? Join the waitlist
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="eb-actions">
        <button type="button" className="eb-btn eb-btn--ghost" onClick={onBack}>
          <ArrowLeft size={15} aria-hidden /> Back
        </button>
      </div>
    </div>
  );
}
