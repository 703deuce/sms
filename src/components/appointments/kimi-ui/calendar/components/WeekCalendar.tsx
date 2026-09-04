import React from "react";
import { CheckCircle2, Clock, XCircle, Settings } from "lucide-react";
import { weekDays, weekEvents, hours, typeColors } from "../mock-data";

const HOUR_H = 56;
const START = 8;

function StatusIcon({ status }: { status: string }) {
  if (status === "confirmed") return <CheckCircle2 size={13} className="ev-status confirmed" />;
  if (status === "pending") return <Clock size={13} className="ev-status pending" />;
  return <XCircle size={13} className="ev-status canceled" />;
}

export default function WeekCalendar() {
  return (
    <div className="week-card">
      <div className="week-grid">
        {/* header row */}
        <div className="wg-corner">
          <span className="gmt">GMT-4</span>
        </div>
        {weekDays.map((d) => (
          <div key={d.label} className={`wg-day-head ${d.today ? "today" : ""}`}>
            <span className="wg-dow">{d.label}</span>
            <span className="wg-date">
              {d.date}
              {d.today && <span className="today-badge">4</span>}
            </span>
          </div>
        ))}
        {/* time rows */}
        {hours.map((h) => (
          <React.Fragment key={h}>
            <div className="wg-time">{h}</div>
            {weekDays.map((d) => (
              <div key={d.label + h} className="wg-cell" />
            ))}
          </React.Fragment>
        ))}

        {/* now line */}
        <div
          className="now-line"
          style={{ top: 57 + (10.25 - START) * HOUR_H }}
        >
          <span className="now-label">10:15 AM</span>
          <span className="now-track" />
          <span className="now-dot" />
        </div>

        {/* events */}
        {weekEvents.map((ev) => {
          const top = 57 + (ev.start - START) * HOUR_H + 3;
          const height = ev.duration * HOUR_H - 8;
          return (
            <div
              key={ev.id}
              className={`week-event ev-${ev.type}`}
              style={{
                top,
                height,
                left: `calc(${(ev.day / 7) * 100}% + 48px / 7 * 0 )`,
              }}
              data-day={ev.day}
            >
              <div className="ev-time">{ev.timeLabel}</div>
              <div className="ev-title-row">
                <span className="ev-title">{ev.title}</span>
                <StatusIcon status={ev.status} />
              </div>
              <div className="ev-name">{ev.name}</div>
            </div>
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
        <button className="cal-settings">
          <Settings size={14} /> Show calendar settings
        </button>
      </div>
    </div>
  );
}
