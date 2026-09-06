"use client";

import { Plus, Trash2 } from "lucide-react";
import { DAY_LABELS } from "../mock-data";
import type { TimeWindow } from "../mock-data";

type Props = {
  weeklyHours: Record<string, TimeWindow[]>;
  onUpdateWindow: (day: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (day: string) => void;
  onRemoveWindow: (day: string, index: number) => void;
};

export default function WeeklyHours({ weeklyHours, onUpdateWindow, onAddWindow, onRemoveWindow }: Props) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-2">
      <div className="px-6 pt-5 pb-4 border-b border-[#f0eef6] flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight">Weekly hours</h2>
          <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
            Recurring availability. Add multiple windows per day for split shifts.
          </p>
        </div>
        <span className="text-[11px] font-medium text-[#8a87a0] bg-[#f4f2fa] rounded-full px-2.5 py-1 whitespace-nowrap mt-0.5">
          Repeats weekly
        </span>
      </div>
      <ul className="divide-y divide-[#f3f1f8]">
        {DAY_LABELS.map(({ key, label }) => {
          const windows = weeklyHours[key] || [];
          const open = windows.length > 0;
          return (
            <li key={key} className="px-6 py-3.5 flex items-start gap-4 group">
              <div className="w-[118px] shrink-0 pt-1.5 flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${open ? "bg-[#16a05a]" : "bg-[#d5d2e2]"}`}
                  aria-hidden="true"
                />
                <span className="text-[13.5px] font-semibold">{label}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                {open ? (
                  windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="time"
                        aria-label={`${label} window ${i + 1} start`}
                        className="avail-time"
                        value={w.open}
                        onChange={(e) => onUpdateWindow(key, i, "open", e.target.value)}
                      />
                      <span className="text-[12px] text-[#8a87a0]">to</span>
                      <input
                        type="time"
                        aria-label={`${label} window ${i + 1} end`}
                        className="avail-time"
                        value={w.close}
                        onChange={(e) => onUpdateWindow(key, i, "close", e.target.value)}
                      />
                      <button
                        type="button"
                        aria-label={`Remove ${label} window ${i + 1}`}
                        className="avail-icon-btn"
                        onClick={() => onRemoveWindow(key, i)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-[12.5px] text-[#a5a3b8] pt-1.5">No availability on {label}s.</p>
                )}
              </div>
              <button
                type="button"
                className="avail-btn-mini mt-1 shrink-0"
                onClick={() => onAddWindow(key)}
              >
                <Plus size={12} />
                Add window
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
