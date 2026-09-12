import React from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import type { CalendarViewMode } from "@/features/appointments/kimi/calendar/types";
import { CalendarAddMenu } from "@/components/appointments/calendar/calendar-add-menu";

type Props = {
  rangeLabel: string;
  view: CalendarViewMode;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onViewChange: (view: CalendarViewMode) => void;
  onNewAppointment: () => void;
  onBlockTime: () => void;
  onWaitlist?: () => void;
};

const VIEW_OPTIONS: Array<{ value: CalendarViewMode; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
];

export default function CalendarHeader({
  rangeLabel,
  view,
  onToday,
  onPrev,
  onNext,
  onViewChange,
  onNewAppointment,
  onBlockTime,
  onWaitlist,
}: Props) {
  return (
    <div className="cal-header">
      <div className="cal-title-wrap">
        <Calendar size={22} className="cal-title-icon" aria-hidden />
        <div>
          <h1 className="cal-title">Calendar</h1>
          <p className="cal-subtitle">Manage appointments, availability, classes, and schedule changes.</p>
        </div>
      </div>
      <div className="cal-controls">
        <button type="button" className="btn-today" onClick={onToday}>
          Today
        </button>
        <div className="nav-arrows">
          <button type="button" className="icon-btn" onClick={onPrev} aria-label="Previous period">
            <ChevronLeft size={16} />
          </button>
          <button type="button" className="icon-btn" onClick={onNext} aria-label="Next period">
            <ChevronRight size={16} />
          </button>
        </div>
        <button type="button" className="btn-range" aria-label="Current range">
          <span className="btn-range-label">{rangeLabel}</span>
          <ChevronDown size={14} />
        </button>
        <div className="view-toggle" role="group" aria-label="Calendar view">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={view === opt.value}
              className={`vt-btn ${view === opt.value ? "active" : ""}`}
              onClick={() => onViewChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <CalendarAddMenu
          onNewAppointment={onNewAppointment}
          onBlockTime={onBlockTime}
          onWaitlist={onWaitlist}
        />
      </div>
    </div>
  );
}
