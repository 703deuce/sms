import React, { useState } from "react";
import { CheckCircle2, Clock, Repeat, Users, XCircle, Settings } from "lucide-react";
import { CalendarMeetingBadges } from "@/components/appointments/kimi-ui/calendar/meeting-badges";
import type {
  CalendarAvailabilityBand,
  CalendarBusyBlock,
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

function kindBadge(kind?: string) {
  if (!kind || kind === "SERVICE") return null;
  return <span className="ev-kind-badge">{kind === "CLASS" ? "Class" : kind === "MEETING" ? "Meeting" : "Event"}</span>;
}

type Props = {
  weekDays: CalendarWeekDay[];
  weekEvents: CalendarWeekEvent[];
  busyBlocks?: CalendarBusyBlock[];
  availabilityBands?: CalendarAvailabilityBand[];
  hours: string[];
  typeColors: Record<string, CalendarTypeColor>;
  nowLine: CalendarNowLine | null;
  timezoneLabel: string;
  onOpenAppointment: (id: string) => void;
  onShowCalendarSettings: () => void;
  onSlotClick?: (input: { dateKey: string; hour: number }) => void;
  onEventMove?: (input: { id: string; fromStartsAt: string; toStartsAt: string; staffId?: string | null }) => void;
};

export default function WeekCalendar({
  weekDays,
  weekEvents,
  busyBlocks = [],
  availabilityBands = [],
  hours,
  typeColors,
  nowLine,
  timezoneLabel,
  onOpenAppointment,
  onShowCalendarSettings,
  onSlotClick,
  onEventMove,
}: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function handleDrop(dayKey: string, hour: number, event: CalendarWeekEvent) {
    if (!onEventMove) return;
    const d = new Date(dayKey);
    d.setHours(hour, 0, 0, 0);
    onEventMove({
      id: event.id,
      fromStartsAt: "",
      toStartsAt: d.toISOString(),
      staffId: event.staffId,
    });
    setDraggingId(null);
  }

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
                onDrop={() => {
                  const ev = weekEvents.find((e) => e.id === draggingId);
                  if (ev) handleDrop(d.dateKey, START + hi, ev);
                }}
              />
            ))}
          </React.Fragment>
        ))}

        {availabilityBands.map((band, i) => (
          <div
            key={`avail-${i}`}
            className="cal-availability-band"
            style={{
              top: 57 + (band.start - START) * HOUR_H,
              height: band.duration * HOUR_H - 4,
              left: `calc(64px + ${band.day} * ((100% - 64px) / ${weekDays.length}))`,
              width: `calc((100% - 64px) / ${weekDays.length})`,
            }}
            aria-hidden
          />
        ))}

        {busyBlocks.map((block) => {
          const top = 57 + (block.start - START) * HOUR_H + 3;
          const height = block.duration * HOUR_H - 8;
          return (
            <div
              key={block.id}
              className="cal-busy-block"
              style={{
                top,
                height,
                left: `calc(64px + ${block.day} * ((100% - 64px) / ${weekDays.length}))`,
                width: `calc((100% - 64px) / ${weekDays.length} - 8px)`,
              }}
              title={`${block.label} — ${block.source}`}
            >
              <span>{block.label}</span>
            </div>
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
          return (
            <button
              key={ev.id}
              type="button"
              className={`week-event ev-${ev.type}`}
              style={{ top, height, borderLeftColor: ev.colorDot || undefined }}
              data-day={ev.day}
              draggable={Boolean(onEventMove) && ev.eventKind !== "external_busy"}
              onDragStart={() => setDraggingId(ev.id)}
              onDragEnd={() => setDraggingId(null)}
              onClick={() => onOpenAppointment(ev.id)}
              title={`${ev.timeLabel} — ${ev.title} with ${ev.name}`}
            >
              <div className="ev-time">{ev.timeLabel}</div>
              <div className="ev-title-row">
                {kindBadge(ev.bookingKind)}
                <span className="ev-title">{ev.title}</span>
                <StatusIcon status={ev.status} />
              </div>
              <div className="ev-name">{ev.name}</div>
              {ev.capacityLabel ? (
                <div className="ev-capacity"><Users size={11} /> {ev.capacityLabel}</div>
              ) : null}
              {ev.isRecurring ? (
                <div className="ev-recurring"><Repeat size={11} /> {ev.recurringLabel || "Recurring"}</div>
              ) : null}
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
