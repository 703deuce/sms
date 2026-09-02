"use client";

import { useMemo, useState } from "react";
import { X, Calendar } from "lucide-react";
import type { BroadcastRecurrence } from "@/lib/mass-texting/broadcast/types";
import {
  defaultRecurrence,
  formatRecurrenceSummary,
  validateRecurrence,
} from "@/lib/campaigns/recurrence-format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ["00", "15", "30", "45"];

type RecurringModalProps = {
  timezone: string;
  initial?: BroadcastRecurrence;
  onClose: () => void;
  onSet: (recurrence: BroadcastRecurrence, summary: string) => void;
};

export default function RecurringModal({
  timezone,
  initial,
  onClose,
  onSet,
}: RecurringModalProps) {
  const [rec, setRec] = useState<BroadcastRecurrence>(
    initial ? { ...initial, timezone: initial.timezone || timezone } : defaultRecurrence(timezone),
  );

  const unitLabel = rec.unit === "days" ? "Days" : rec.unit === "weeks" ? "Weeks" : "Months";

  const summary = useMemo(() => formatRecurrenceSummary(rec, timezone), [rec, timezone]);
  const validationError = useMemo(() => validateRecurrence(rec), [rec]);

  const toggleWeekday = (dayIndex: number) => {
    const current = rec.weekdays ?? [];
    const next = current.includes(dayIndex)
      ? current.filter((d) => d !== dayIndex)
      : [...current, dayIndex].sort((a, b) => a - b);
    setRec({ ...rec, weekdays: next.length ? next : [dayIndex] });
  };

  const handleSet = () => {
    if (validationError) return;
    onSet({ ...rec, timezone }, summary);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card w-[420px] p-6 fade-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[16px] font-bold text-slate-900">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-100">
              <Calendar className="h-3.5 w-3.5 text-indigo-600" />
            </span>
            Recurring Send
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-1 mt-4 block text-[12px] font-semibold text-slate-600">Starting On</label>
        <input
          type="date"
          min={new Date().toISOString().slice(0, 10)}
          value={rec.startDate}
          onChange={(e) => setRec({ ...rec, startDate: e.target.value })}
          className="input-field !text-[13px]"
        />

        <label className="mb-1 mt-4 block text-[12px] font-semibold text-slate-600">Repeat Every</label>
        <div className="flex gap-2">
          <select
            value={String(rec.interval)}
            onChange={(e) => setRec({ ...rec, interval: Number(e.target.value) })}
            className="input-field !w-20 !text-[13px]"
          >
            {["1", "2", "3", "4"].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <select
            value={unitLabel}
            onChange={(e) => {
              const unit =
                e.target.value === "Days" ? "days" : e.target.value === "Weeks" ? "weeks" : "months";
              setRec({
                ...rec,
                unit,
                weekdays: unit === "weeks" ? rec.weekdays?.length ? rec.weekdays : [new Date(rec.startDate).getDay()] : undefined,
              });
            }}
            className="input-field flex-1 !text-[13px]"
          >
            <option>Days</option>
            <option>Weeks</option>
            <option>Months</option>
          </select>
        </div>

        {rec.unit === "weeks" ? (
          <>
            <label className="mb-1 mt-4 block text-[12px] font-semibold text-slate-600">
              On the following weekdays
            </label>
            <div className="flex gap-1">
              {WEEKDAYS.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleWeekday(index)}
                  className={`weekday-btn ${rec.weekdays?.includes(index) ? "on" : ""}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        ) : null}

        <label className="mb-1 mt-4 block text-[12px] font-semibold text-slate-600">Sending At</label>
        <div className="flex gap-2">
          <select
            value={String(rec.sendHour)}
            onChange={(e) => setRec({ ...rec, sendHour: Number(e.target.value) })}
            className="input-field !w-16 !text-[13px]"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
          <select
            value={String(rec.sendMinute).padStart(2, "0")}
            onChange={(e) => setRec({ ...rec, sendMinute: Number(e.target.value) })}
            className="input-field !w-16 !text-[13px]"
          >
            {MINUTES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={rec.ampm}
            onChange={(e) => setRec({ ...rec, ampm: e.target.value as "AM" | "PM" })}
            className="input-field !w-20 !text-[13px]"
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </div>

        <label className="mb-1 mt-4 block text-[12px] font-semibold text-slate-600">Ending</label>
        <div className="seg-toggle w-full">
          {(["never", "on", "after"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setRec({ ...rec, endMode: mode })}
              className={`flex-1 capitalize ${rec.endMode === mode ? "on" : ""}`}
            >
              {mode === "never" ? "Never" : mode === "on" ? "On" : "After"}
            </button>
          ))}
        </div>

        {rec.endMode === "on" ? (
          <div className="mt-3">
            <label className="mb-1 block text-[12px] font-semibold text-slate-600">End Date</label>
            <input
              type="date"
              min={rec.startDate}
              value={rec.endDate || ""}
              onChange={(e) => setRec({ ...rec, endDate: e.target.value })}
              className="input-field !text-[13px]"
            />
          </div>
        ) : null}

        {rec.endMode === "after" ? (
          <div className="mt-3">
            <label className="mb-1 block text-[12px] font-semibold text-slate-600">Number of Sends</label>
            <input
              type="number"
              min={1}
              value={rec.endAfter ?? 10}
              onChange={(e) => setRec({ ...rec, endAfter: Number(e.target.value) })}
              className="input-field !text-[13px]"
            />
          </div>
        ) : null}

        <p className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 text-[12px] leading-relaxed text-indigo-800">
          {summary}
        </p>
        {validationError ? (
          <p className="mt-2 text-[12px] font-medium text-red-600">{validationError}</p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleSet}
            disabled={Boolean(validationError)}
            className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Set
          </button>
          <button type="button" onClick={onClose} className="btn-ghost flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
