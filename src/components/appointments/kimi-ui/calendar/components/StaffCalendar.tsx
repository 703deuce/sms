import React from "react";
import { CheckCircle2, Clock, Repeat, Users, XCircle } from "lucide-react";
import { CalendarMeetingBadges } from "@/components/appointments/kimi-ui/calendar/meeting-badges";
import type {
  CalendarAvailabilityBand,
  CalendarBusyBlock,
  CalendarNowLine,
  CalendarStaffLane,
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
  staffLanes: CalendarStaffLane[];
  weekEvents: CalendarWeekEvent[];
  busyBlocks: CalendarBusyBlock[];
  availabilityBands: CalendarAvailabilityBand[];
  hours: string[];
  nowLine: CalendarNowLine | null;
  timezoneLabel: string;
  onOpenAppointment: (id: string) => void;
  onEventMove?: (input: { id: string; fromStartsAt: string; toStartsAt: string; staffId?: string | null }) => void;
  onSlotClick?: (input: { dateKey: string; hour: number; staffId?: string }) => void;
  dateKey: string;
};

export default function StaffCalendar({
  staffLanes,
  weekEvents,
  busyBlocks,
  availabilityBands,
  hours,
  nowLine,
  timezoneLabel,
  onOpenAppointment,
  onSlotClick,
  dateKey,
}: Props) {
  const lanes = staffLanes.length ? staffLanes : [{ id: "unassigned", name: "Unassigned", color: "#6366f1" }];

  return (
    <div className="week-card staff-view">
      <div className="week-grid" style={{ gridTemplateColumns: `64px repeat(${lanes.length}, minmax(140px, 1fr))` }}>
        <div className="wg-corner">
          <span className="gmt">{timezoneLabel}</span>
        </div>
        {lanes.map((lane) => (
          <div key={lane.id} className="wg-day-head today">
            <span className="wg-dow" style={{ color: lane.color }}>■</span>
            <span className="wg-date">{lane.name}</span>
          </div>
        ))}
        {hours.map((h, hi) => (
          <React.Fragment key={h}>
            <div className="wg-time">{h}</div>
            {lanes.map((lane, laneIndex) => (
              <button
                key={lane.id + h}
                type="button"
                className="wg-cell today-col"
                aria-label={`Create appointment for ${lane.name} at ${h}`}
                onClick={() => onSlotClick?.({ dateKey, hour: START + hi, staffId: lane.id })}
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
              gridColumn: band.staffLane != null ? band.staffLane + 2 : undefined,
            }}
            aria-hidden
          />
        ))}

        {busyBlocks.map((block) => {
          const top = 57 + (block.start - START) * HOUR_H + 3;
          const height = block.duration * HOUR_H - 8;
          const col = (block.staffLane ?? 0) + 2;
          return (
            <div
              key={block.id}
              className="cal-busy-block"
              style={{ top, height, gridColumn: col }}
              title={`${block.label} — ${block.source}`}
            >
              <span>{block.label}</span>
              <span className="cal-busy-source">{block.source}</span>
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
          const lane = ev.staffLane ?? 0;
          const top = 57 + (ev.start - START) * HOUR_H + 3;
          const height = ev.duration * HOUR_H - 8;
          return (
            <button
              key={ev.id}
              type="button"
              className="week-event ev-consultation"
              style={{
                top,
                height,
                gridColumn: lane + 2,
                borderLeftColor: ev.colorDot || undefined,
              }}
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
              <CalendarMeetingBadges meeting={ev.meeting} appointmentId={ev.id} eventKind={ev.eventKind} compact />
            </button>
          );
        })}
      </div>
    </div>
  );
}
