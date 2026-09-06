import React from "react";
import { Settings } from "lucide-react";
import type { CalendarMonthDay, CalendarTypeColor } from "@/features/appointments/kimi/calendar/types";

const DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

type Props = {
  monthDays: CalendarMonthDay[];
  typeColors: Record<string, CalendarTypeColor>;
  onOpenAppointment: (id: string) => void;
  onSelectDay: (dateKey: string) => void;
  onShowCalendarSettings: () => void;
};

export default function MonthCalendar({
  monthDays,
  typeColors,
  onOpenAppointment,
  onSelectDay,
  onShowCalendarSettings,
}: Props) {
  return (
    <div className="week-card month-card">
      <div className="month-grid">
        {DOW.map((label) => (
          <div key={label} className="month-dow">{label}</div>
        ))}
        {monthDays.map((cell) => (
          <button
            key={cell.dateKey}
            type="button"
            className={`month-cell ${cell.muted ? "muted" : ""} ${cell.today ? "today" : ""}`}
            onClick={() => onSelectDay(cell.dateKey)}
          >
            <span className="month-day-num">{cell.day}</span>
            <div className="month-events">
              {cell.events.slice(0, 3).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`month-event ev-${ev.type}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAppointment(ev.id);
                  }}
                  title={`${ev.timeLabel} ${ev.title}`}
                >
                  <span className="month-event-time">{ev.timeLabel}</span>
                  <span className="month-event-title">{ev.title}</span>
                </button>
              ))}
              {cell.events.length > 3 ? (
                <span className="month-more">+{cell.events.length - 3} more</span>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      <div className="week-footer">
        <div className="legend">
          {Object.entries(typeColors).map(([k, c]) => (
            <span key={k} className="legend-item">
              <span className="legend-dot" style={{ background: c.dot }} />
              {c.label}
            </span>
          ))}
        </div>
        <button type="button" className="cal-settings" onClick={onShowCalendarSettings}>
          <Settings size={14} /> Show calendar settings
        </button>
      </div>
    </div>
  );
}
