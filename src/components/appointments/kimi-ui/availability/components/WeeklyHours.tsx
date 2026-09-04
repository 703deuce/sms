import { Clock, CalendarDays, Plus, Trash2 } from "lucide-react";
import type { DayScheduleRow } from "@/features/appointments/kimi/availability/types";

interface Props {
  days: DayScheduleRow[];
  onUpdateWindow: (day: string, index: number, field: "open" | "close", value: string) => void;
  onAddWindow: (day: string) => void;
  onRemoveWindow: (day: string, index: number) => void;
}

export default function WeeklyHours({ days, onUpdateWindow, onAddWindow, onRemoveWindow }: Props) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-2">
      <div className="avail-card-header">
        <div className="flex items-start gap-3">
          <span className="avail-icon-chip mt-0.5">
            <Clock size={15} />
          </span>
          <div>
            <h2 className="text-[14.5px] font-semibold text-[#1c1a2e]">Weekly hours</h2>
            <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
              Set your recurring availability. Add multiple windows to allow split shifts.
            </p>
          </div>
        </div>
        <button type="button" className="avail-btn-ghost">
          <CalendarDays size={13} />
          Copy from calendar
        </button>
      </div>

      <div className="px-[22px] py-3">
        {days.map((d, i) => (
          <div
            key={d.key}
            className={`flex items-center gap-4 py-3.5 ${
              i < days.length - 1 ? "border-b border-[#f2f1f7]" : ""
            }`}
          >
            <div className="w-[110px] flex items-center gap-2.5 shrink-0">
              <span className="text-[13px] font-semibold text-[#1c1a2e]">{d.day}</span>
              <span className={`avail-pill ${d.open ? "avail-pill-open" : "avail-pill-closed"}`}>
                {d.open ? "Open" : "Closed"}
              </span>
            </div>

            <div className="flex-1 flex flex-col gap-2">
              {d.open ? (
                d.windows.map((window, idx) => (
                  <div key={`${d.key}-${idx}`} className="flex items-center gap-3">
                    <input
                      type="time"
                      className="avail-input w-[130px] font-medium text-[12.5px]"
                      value={window.open}
                      onChange={(e) => onUpdateWindow(d.key, idx, "open", e.target.value)}
                    />
                    <span className="text-[12.5px] text-[#8a87a0]">to</span>
                    <input
                      type="time"
                      className="avail-input w-[130px] font-medium text-[12.5px]"
                      value={window.close}
                      onChange={(e) => onUpdateWindow(d.key, idx, "close", e.target.value)}
                    />
                    <button
                      type="button"
                      className="avail-icon-btn"
                      aria-label="Remove window"
                      onClick={() => onRemoveWindow(d.key, idx)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-[13px] text-[#8a87a0]">{d.closedNote}</span>
              )}
            </div>

            <button type="button" className="avail-add-link shrink-0" onClick={() => onAddWindow(d.key)}>
              <Plus size={14} />
              Add window
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
