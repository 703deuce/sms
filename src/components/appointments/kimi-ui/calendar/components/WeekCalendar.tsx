import React from "react";
import { Settings } from "lucide-react";
import { CalendarDraggableEvent } from "@/components/appointments/calendar/calendar-draggable-event";
import type {
  CalendarNowLine,
  CalendarTypeColor,
  CalendarWeekDay,
  CalendarWeekEvent,
} from "@/features/appointments/kimi/calendar/types";

const START = 8;

type Props = {
  weekDays: CalendarWeekDay[];
  weekEvents: CalendarWeekEvent[];
  hours: string[];
  typeColors: Record<string, CalendarTypeColor>;
  nowLine: CalendarNowLine | null;
  timezoneLabel: string;
  onOpenAppointment: (id: string) => void;
  onShowCalendarSettings: () => void;
  onSlotClick?: (input: { dateKey: string; hour: number }) => void;
  weekStart?: Date;
  dragOverrides?: Record<string, { day: number; start: number }>;
  onDragPreview?: (input: { id: string; day: number; start: number }) => void;
  onDragClear?: (id: string) => void;
  onDragCommit?: (input: { id: string; startsAt: string }) => void;
  slotWaitlistCounts?: Record<string, number>;
  onWaitlistSlotClick?: (input: { dateKey: string; hour: number; count: number }) => void;
};

export default function WeekCalendar({
  weekDays,
  weekEvents,
  hours,
  typeColors,
  nowLine,
  timezoneLabel,
  onOpenAppointment,
  onShowCalendarSettings,
  onSlotClick,
  weekStart,
  dragOverrides,
  onDragPreview,
  onDragClear,
  onDragCommit,
  slotWaitlistCounts,
  onWaitlistSlotClick,
}: Props) {
  const effectiveWeekStart = weekStart || new Date();
  return (
    <div className="week-card">
      <div className="week-grid">
        <div className="wg-corner">
          <span className="gmt">{timezoneLabel}</span>
        </div>
        {weekDays.map((d) => (
          <div key={d.dateKey} className={`wg-day-head ${d.today ? "today" : ""}`}>
            <span className="wg-dow">{d.label}</span>
            <span className="wg-date">
              {d.date}
              {d.today ? (
                <span className="today-badge">{new Date(d.dateKey).getDate()}</span>
              ) : null}
            </span>
          </div>
        ))}
        {hours.map((h, hi) => (
          <React.Fragment key={h}>
            <div className="wg-time">{h}</div>
            {weekDays.map((d) => {
              const slotKey = `${d.dateKey}:${START + hi}`;
              const matchCount = slotWaitlistCounts?.[slotKey] || 0;
              return (
                <button
                  key={d.dateKey + h}
                  type="button"
                  className={`wg-cell ${d.today ? "today-col" : ""}`}
                  aria-label={`Create appointment ${d.label} ${h}`}
                  onClick={() => onSlotClick?.({ dateKey: d.dateKey, hour: START + hi })}
                >
                  {matchCount > 0 ? (
                    <span
                      className="cal-waitlist-slot-badge"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onWaitlistSlotClick?.({ dateKey: d.dateKey, hour: START + hi, count: matchCount });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onWaitlistSlotClick?.({ dateKey: d.dateKey, hour: START + hi, count: matchCount });
                        }
                      }}
                    >
                      {matchCount} waitlist {matchCount === 1 ? "match" : "matches"}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </React.Fragment>
        ))}

        {nowLine ? (
          <div className="now-line" style={{ top: nowLine.top }} aria-hidden>
            <span className="now-label">{nowLine.label}</span>
            <span className="now-track" />
            <span className="now-dot" />
          </div>
        ) : null}

        {weekEvents.map((ev) =>
          onDragCommit && onDragPreview && onDragClear ? (
            <CalendarDraggableEvent
              key={ev.id}
              ev={ev}
              weekStart={effectiveWeekStart}
              dragOverride={dragOverrides?.[ev.id]}
              onOpen={onOpenAppointment}
              onDragPreview={onDragPreview}
              onDragClear={onDragClear}
              onDragCommit={onDragCommit}
            />
          ) : (
            <button
              key={ev.id}
              type="button"
              className={`week-event ev-${ev.type}`}
              style={{
                top: 57 + (ev.start - START) * 56 + 3,
                height: ev.duration * 56 - 8,
              }}
              data-day={ev.day}
              onClick={() => onOpenAppointment(ev.id)}
              title={`${ev.timeLabel} — ${ev.title} with ${ev.name}`}
            >
              <div className="ev-time">{ev.timeLabel}</div>
              <div className="ev-title-row">
                <span className="ev-title">{ev.title}</span>
              </div>
              <div className="ev-name">{ev.name}</div>
            </button>
          ),
        )}
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
