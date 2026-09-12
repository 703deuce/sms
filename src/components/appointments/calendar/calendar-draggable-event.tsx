"use client";

import { useCallback, useRef, useState } from "react";
import type { CalendarWeekDay, CalendarWeekEvent } from "@/features/appointments/kimi/calendar/types";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { CalendarMeetingBadges } from "@/components/appointments/kimi-ui/calendar/meeting-badges";
import {
  dayIndexFromPointer,
  decimalHourFromPointer,
  isReschedulableCalendarEventId,
} from "@/features/appointments/kimi/calendar/calendar-drag-math";

const HOUR_H = 56;
const START = 8;

function StatusIcon({ status }: { status: string }) {
  if (status === "confirmed") return <CheckCircle2 size={13} className="ev-status confirmed" />;
  if (status === "pending") return <Clock size={13} className="ev-status pending" />;
  return <XCircle size={13} className="ev-status canceled" />;
}

type Props = {
  ev: CalendarWeekEvent;
  weekDays: CalendarWeekDay[];
  timeZone: string;
  dragOverride?: { day: number; start: number };
  onOpen: (id: string) => void;
  onDragPreview: (input: { id: string; day: number; start: number }) => void;
  onDragClear: (id: string) => void;
  onDragCommit: (input: { id: string; startsAt: string }) => void;
  singleDay?: boolean;
};

export function CalendarDraggableEvent({
  ev,
  weekDays,
  timeZone,
  dragOverride,
  onOpen,
  onDragPreview,
  onDragClear,
  onDragCommit,
  singleDay,
}: Props) {
  const day = dragOverride?.day ?? ev.day;
  const start = dragOverride?.start ?? ev.start;
  const top = 57 + (start - START) * HOUR_H + 3;
  const height = ev.duration * HOUR_H - 8;
  const draggable = isReschedulableCalendarEventId(ev.id) && ev.status !== "canceled";
  const gridRef = useRef<HTMLElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const origin = useRef<{ day: number; start: number } | null>(null);
  const moved = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggable || e.button !== 0) return;
      const grid = e.currentTarget.closest(".week-grid") as HTMLElement | null;
      gridRef.current = grid;
      origin.current = { day: ev.day, start: ev.start };
      moved.current = false;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [draggable, ev.day, ev.start],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging || !gridRef.current || !origin.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const dayIdx = singleDay ? 0 : dayIndexFromPointer(rect.left, rect.width, e.clientX);
      const hour = decimalHourFromPointer(rect.top, e.clientY, gridRef.current.scrollTop);
      if (dayIdx !== origin.current.day || Math.abs(hour - origin.current.start) > 0.01) {
        moved.current = true;
      }
      onDragPreview({ id: ev.id, day: dayIdx, start: hour });
    },
    [dragging, onDragPreview, ev.id, singleDay],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!dragging) return;
      setDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (!moved.current || !gridRef.current || !origin.current) {
        onDragClear(ev.id);
        onOpen(ev.id);
        return;
      }
      const rect = gridRef.current.getBoundingClientRect();
      const dayIdx = singleDay ? 0 : dayIndexFromPointer(rect.left, rect.width, e.clientX);
      const hour = decimalHourFromPointer(rect.top, e.clientY, gridRef.current.scrollTop);
      const dayInfo = weekDays[dayIdx] || weekDays[0];
      if (!dayInfo) return;
      const startsAt = isoFromDayAndHour(dayInfo.isoDate, hour, timeZone);
      onDragCommit({ id: ev.id, startsAt });
    },
    [dragging, ev.id, onDragClear, onDragCommit, onOpen, singleDay, timeZone, weekDays],
  );

  return (
    <button
      type="button"
      className={`week-event ev-${ev.type} ${dragging ? "week-event--dragging" : ""} ${draggable ? "week-event--draggable" : ""}`}
      style={{ top, height }}
      data-day={String(day)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        setDragging(false);
        onDragClear(ev.id);
      }}
      onClick={(e) => e.preventDefault()}
      title={`${ev.timeLabel} — ${ev.title} with ${ev.name}`}
    >
      <div className="ev-time">{ev.timeLabel}</div>
      <div className="ev-title-row">
        <span className="ev-title">{ev.title}</span>
        <StatusIcon status={ev.status} />
      </div>
      <div className="ev-name">{ev.name}</div>
      {ev.subtitle ? <div className="ev-meta">{ev.subtitle}</div> : null}
      {ev.paymentLabel ? <div className="ev-meta ev-pay">{ev.paymentLabel}</div> : null}
      <CalendarMeetingBadges meeting={ev.meeting} appointmentId={ev.id} eventKind={ev.eventKind} compact />
    </button>
  );
}
