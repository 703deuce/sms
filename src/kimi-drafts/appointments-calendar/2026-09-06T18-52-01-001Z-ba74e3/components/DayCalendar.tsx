"use client";
import React from "react";
import { Video } from "lucide-react";
import { HOURS, TYPE_COLORS, type CalEvent } from "../mock-data";

const HOUR_H = 56;
type Day = { label: string; date: string; today: boolean };

type Props = {
  weekDays: Day[];
  weekEvents: CalEvent[];
  hours: string[];
  onOpenAppointment: (id: string) => void;
  onSlotClick: (dayIndex: number, hour: number) => void;
  onShowCalendarSettings: () => void;
};

export default function DayCalendar({ weekDays, weekEvents, onOpenAppointment, onSlotClick }: Props) {
  const todayIdx = weekDays.findIndex((d) => d.today);
  const dayIdx = todayIdx >= 0 ? todayIdx : 0;
  const day = weekDays[dayIdx];
  const events = weekEvents.filter((e) => e.day === dayIdx);
  return (
    <div className="card week-card overflow-hidden">
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{day.label}</div>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[15px] font-semibold text-white">{day.date}</span>
          <span className="text-[13px] font-medium text-gray-600">{events.length} appointment{events.length === 1 ? "" : "s"}</span>
        </div>
      </div>
      <div className="relative flex" style={{ height: HOURS.length * HOUR_H }}>
        <div className="w-16 shrink-0 border-r border-gray-100">
          {HOURS.map((h) => (
            <div key={h} className="relative" style={{ height: HOUR_H }}>
              <span className="absolute -top-2 right-2 text-[11px] text-gray-400">{h}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1">
          {HOURS.map((_, hi) => (
            <div key={hi} className="border-b border-gray-100" style={{ height: HOUR_H }} />
          ))}
          {HOURS.map((_, hi) => (
            <button
              key={`slot-${hi}`}
              aria-label={`New appointment at ${HOURS[hi]}`}
              className="slot-btn"
              style={{ top: hi * HOUR_H, height: HOUR_H }}
              onClick={() => onSlotClick(dayIdx, hi + 8)}
            />
          ))}
          {events.map((e, i) => {
            const c = TYPE_COLORS[e.type];
            return (
              <button
                key={e.id}
                onClick={() => onOpenAppointment(e.id)}
                className="absolute z-[2] overflow-hidden rounded-md border px-2 py-1.5 text-left transition-shadow hover:shadow-md"
                style={{
                  top: (e.start - 8) * HOUR_H + 2,
                  height: e.duration * HOUR_H - 4,
                  left: `${(i % 2) * 50 + 4}%`,
                  right: i % 2 ? 4 : "50%",
                  background: c.bg,
                  borderColor: c.border,
                  borderLeft: `3px solid ${c.dot}`,
                }}
              >
                <div className="flex items-center gap-1">
                  <div className="truncate text-[12px] font-semibold" style={{ color: c.text }}>{e.title}</div>
                  {e.hasVideo && <Video className="h-3 w-3 shrink-0" style={{ color: c.text }} aria-label="Video meeting" />}
                </div>
                <div className="truncate text-[11px] text-gray-500">{e.timeLabel} · {e.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
