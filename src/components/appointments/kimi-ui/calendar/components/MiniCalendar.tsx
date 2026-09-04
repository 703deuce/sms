import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CalendarMiniDay } from "@/features/appointments/kimi/calendar/types";

type Props = {
  monthLabel: string;
  days: CalendarMiniDay[];
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (dateKey: string) => void;
};

export default function MiniCalendar({ monthLabel, days, onPrev, onNext, onSelectDay }: Props) {
  return (
    <div className="mini-cal card">
      <div className="mini-head">
        <span className="mini-month">{monthLabel}</span>
        <div className="mini-nav">
          <button type="button" className="icon-btn sm" onClick={onPrev} aria-label="Previous month">
            <ChevronLeft size={14} />
          </button>
          <button type="button" className="icon-btn sm" onClick={onNext} aria-label="Next month">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <div className="mini-grid">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="mini-dow">{d}</span>
        ))}
        {days.map((cell) => (
          <button
            key={cell.dateKey}
            type="button"
            className={`mini-day ${cell.muted ? "muted" : ""} ${cell.selected ? "selected" : ""} ${cell.hasEvent ? "has-event" : ""}`}
            onClick={() => !cell.muted && onSelectDay(cell.dateKey)}
            disabled={cell.muted}
          >
            {cell.day}
          </button>
        ))}
      </div>
    </div>
  );
}
