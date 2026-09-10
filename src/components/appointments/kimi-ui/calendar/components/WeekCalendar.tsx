import React, { useState } from "react";
import { CheckCircle2, Clock, Repeat2, Settings, Users, XCircle } from "lucide-react";
import { CalendarMeetingBadges } from "@/components/appointments/kimi-ui/calendar/meeting-badges";
import type {
  CalendarNowLine,
  CalendarTypeColor,
  CalendarUnavailableBlock,
  CalendarWeekDay,
  CalendarWeekEvent,
} from "@/features/appointments/kimi/calendar/types";

const HOUR_H = 56;
const START = 8;

function StatusIcon({ status }: { status: string }) {
  if (status === "confirmed") return <CheckCircle2 size={13} className="ev-status confirmed" />;
  if (status === "pending") return <Clock size={13} className="ev-status pending" />;
  return <XCircle size={13} className="ev-status canceled" />;
}

type Props = {
  weekDays: CalendarWeekDay[];
  weekEvents: CalendarWeekEvent[];
  hours: string[];
  typeColors: Record<string, CalendarTypeColor>;
  nowLine: CalendarNowLine | null;
  timezoneLabel: string;
  unavailableBlocks?: CalendarUnavailableBlock[];
  onOpenAppointment: (id: string) => void;
  onShowCalendarSettings: () => void;
  onSlotClick?: (input: { dateKey: string; hour: number }) => void;
  onRescheduleEvent?: (input: { id: string; startsAt: string }) => void | Promise<void>;
};

export default function WeekCalendar({
  weekDays,
  weekEvents,
  hours,
  typeColors,
  nowLine,
  timezoneLabel,
  unavailableBlocks = [],
  onOpenAppointment,
  onShowCalendarSettings,
  onSlotClick,
  onRescheduleEvent,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const canDrag = (id: string) =>
    onRescheduleEvent && !id.startsWith("video:") && !id.startsWith("meeting:");

  const handleDrop = (dayIndex: number, hour: number, eventId: string) => {
    const day = weekDays[dayIndex];
    if (!day || !onRescheduleEvent) return;
    const d = new Date(day.dateKey);
    const wholeHour = Math.floor(hour);
    const minutes = Math.round((hour - wholeHour) * 60);
    d.setHours(wholeHour, minutes, 0, 0);
    void onRescheduleEvent({ id: eventId, startsAt: d.toISOString() });
  };

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
            {weekDays.map((d, dayIndex) => (
              <button
                key={d.dateKey + h}
                type="button"
                className={`wg-cell ${d.today ? "today-col" : ""}`}
                aria-label={`Create appointment ${d.label} ${h}`}
                onClick={() => onSlotClick?.({ dateKey: d.dateKey, hour: START + hi })}
                onDragOver={(e) => {
                  if (draggingId) e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const eventId = e.dataTransfer.getData("text/appointment-id");
                  if (eventId) handleDrop(dayIndex, START + hi, eventId);
                  setDraggingId(null);
                }}
              />
            ))}
          </React.Fragment>
        ))}

        {unavailableBlocks.map((block, i) => {
          const top = 57 + (block.start - START) * HOUR_H;
          const height = block.duration * HOUR_H;
          return (
            <div
              key={`unavail-${i}`}
              className="cal-unavailable week-event"
              style={{ top, height, dataDay: block.day } as React.CSSProperties}
              data-day={block.day}
              aria-hidden
              title={block.label || "Unavailable"}
            />
          );
        })}

        {nowLine ? (
          <div className="now-line" style={{ top: nowLine.top }} aria-hidden>
            <span className="now-label">{nowLine.label}</span>
            <span className="now-track" />
            <span className="now-dot" />
          </div>
        ) : null}

        {weekEvents.map((ev) => {
          const top = 57 + (ev.start - START) * HOUR_H + 3;
          const height = ev.duration * HOUR_H - 8;
          const draggable = canDrag(ev.id);
          return (
            <button
              key={ev.id}
              type="button"
              className={`week-event ev-${ev.type} ${draggingId === ev.id ? "dragging" : ""}`}
              style={{
                top,
                height,
                borderLeftColor: ev.colorDot || undefined,
              }}
              data-day={ev.day}
              draggable={draggable}
              onDragStart={(e) => {
                if (!draggable) return;
                e.dataTransfer.setData("text/appointment-id", ev.id);
                setDraggingId(ev.id);
              }}
              onDragEnd={() => setDraggingId(null)}
              onClick={() => onOpenAppointment(ev.id)}
              title={`${ev.timeLabel} — ${ev.title} with ${ev.name}`}
            >
              <div className="ev-time">
                {ev.timeLabel}
                {ev.isRecurring ? (
                  <Repeat2 size={11} className="ev-recurring" aria-label="Recurring" />
                ) : null}
              </div>
              <div className="ev-title-row">
                <span className="ev-title">{ev.title}</span>
                <StatusIcon status={ev.status} />
              </div>
              <div className="ev-name">
                {ev.name}
                {ev.isClassOrEvent && ev.attendeeCount ? (
                  <span className="ev-capacity">
                    <Users size={10} aria-hidden /> {ev.attendeeCount}
                  </span>
                ) : null}
              </div>
              <CalendarMeetingBadges
                meeting={ev.meeting}
                appointmentId={ev.id}
                eventKind={ev.eventKind}
                compact
              />
            </button>
          );
        })}
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
