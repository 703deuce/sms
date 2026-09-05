import React from "react";
import { CheckCircle2, Clock, XCircle, Settings } from "lucide-react";
import { CalendarMeetingBadges } from "@/components/appointments/kimi-ui/calendar/meeting-badges";
import type {
  CalendarNowLine,
  CalendarTypeColor,
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
  onOpenAppointment: (id: string) => void;
  onShowCalendarSettings: () => void;
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
}: Props) {
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
        {hours.map((h) => (
          <React.Fragment key={h}>
            <div className="wg-time">{h}</div>
            {weekDays.map((d) => (
              <div key={d.dateKey + h} className={`wg-cell ${d.today ? "today-col" : ""}`} />
            ))}
          </React.Fragment>
        ))}

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
          return (
            <button
              key={ev.id}
              type="button"
              className={`week-event ev-${ev.type}`}
              style={{ top, height }}
              data-day={ev.day}
              onClick={() => onOpenAppointment(ev.id)}
              title={`${ev.timeLabel} — ${ev.title} with ${ev.name}`}
            >
              <div className="ev-time">{ev.timeLabel}</div>
              <div className="ev-title-row">
                <span className="ev-title">{ev.title}</span>
                <StatusIcon status={ev.status} />
              </div>
              <div className="ev-name">{ev.name}</div>
              <CalendarMeetingBadges meeting={ev.meeting} appointmentId={ev.id} compact />
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
