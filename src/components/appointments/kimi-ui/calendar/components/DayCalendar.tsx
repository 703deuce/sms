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
  timeZone?: string;
  dragOverrides?: Record<string, { day: number; start: number }>;
  onDragPreview?: (input: { id: string; day: number; start: number }) => void;
  onDragClear?: (id: string) => void;
  onDragCommit?: (input: { id: string; startsAt: string }) => void;
  slotWaitlistCounts?: Record<string, number>;
  onWaitlistSlotClick?: (input: { dateKey: string; hour: number; count: number }) => void;
};

export default function DayCalendar({
  weekDays,
  weekEvents,
  hours,
  typeColors,
  nowLine,
  timezoneLabel,
  onOpenAppointment,
  onShowCalendarSettings,
  onSlotClick,
  timeZone = "America/Chicago",
  dragOverrides,
  onDragPreview,
  onDragClear,
  onDragCommit,
  slotWaitlistCounts,
  onWaitlistSlotClick,
}: Props) {
  const day = weekDays[0];
  return (
    <div className="week-card">
      <div className="week-grid day-grid">
        <div className="wg-corner">
          <span className="gmt">{timezoneLabel}</span>
        </div>
        {day ? (
          <div className={`wg-day-head ${day.today ? "today" : ""}`}>
            <span className="wg-dow">{day.label}</span>
            <span className="wg-date">
              {day.date}
              {day.today ? (
                <span className="today-badge">{new Date(day.dateKey).getDate()}</span>
              ) : null}
            </span>
          </div>
        ) : null}
        {hours.map((h, hi) => (
          <React.Fragment key={h}>
            <div className="wg-time">{h}</div>
            <button
              type="button"
              className={`wg-cell ${day?.today ? "today-col" : ""}`}
              aria-label={`Create appointment ${h}`}
              onClick={() => day && onSlotClick?.({ dateKey: day.dateKey, hour: START + hi })}
            />
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
              weekDays={weekDays}
              timeZone={timeZone}
              dragOverride={dragOverrides?.[ev.id]}
              onOpen={onOpenAppointment}
              onDragPreview={onDragPreview}
              onDragClear={onDragClear}
              onDragCommit={onDragCommit}
              singleDay
            />
          ) : (
            <button
              key={ev.id}
              type="button"
              className={`week-event day-event ev-${ev.type}`}
              style={{ top: 57 + (ev.start - START) * 56 + 3, height: ev.duration * 56 - 8 }}
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
