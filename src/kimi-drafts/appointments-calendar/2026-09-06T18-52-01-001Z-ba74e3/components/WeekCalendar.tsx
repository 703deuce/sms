"use client";
import React from "react";
import { HOURS, TYPE_COLORS, type CalEvent } from "../mock-data";

const HOUR_H = 56;

type Day = { label: string; date: string; today: boolean };

type Props = {
  weekDays: Day[];
  weekEvents: CalEvent[];
  hours: string[];
  onOpenAppointment: (id: string) => void;
  onShowCalendarSettings: () => void;
};

export default function WeekCalendar({ weekDays, weekEvents, hours, onOpenAppointment }: Props) {
  return (
    <div className="card week-card overflow-hidden">
      <div className="flex border-b border-gray-200">
        <div className="w-16 shrink-0 border-r border-gray-100" />
        {weekDays.map((d, i) => (
          <div key={i} className={`flex-1 border-r border-gray-100 py-2.5 text-center last:border-r-0 ${d.today ? "bg-indigo-50/50" : ""}`}>
            <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{d.label}</div>
            <div className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-semibold ${d.today ? "bg-indigo-600 text-white" : "text-gray-800"}`}>
              {d.date}
            </div>
          </div>
        ))}
      </div>
      <div className="relative flex" style={{ height: HOURS.length * HOUR_H }}>
        <div className="w-16 shrink-0 border-r border-gray-100">
          {HOURS.map((h, i) => (
            <div key={h} className="relative" style={{ height: HOUR_H }}>
              <span className="absolute -top-2 right-2 text-[11px] text-gray-400">{i > 0 || true ? h : ""}</span>
            </div>
          ))}
        </div>
        {weekDays.map((d, di) => (
          <div key={di} className={`relative flex-1 border-r border-gray-100 last:border-r-0 ${d.today ? "bg-indigo-50/30" : ""}`}>
            {HOURS.map((_, hi) => (
              <div key={hi} className="border-b border-gray-100" style={{ height: HOUR_H }} />
            ))}
            {weekEvents.filter((e) => e.day === di).map((e) => {
              const c = TYPE_COLORS[e.type];
              const top = (e.start - 8) * HOUR_H + 2;
              const height = e.duration * HOUR_H - 4;
              return (
                <button
                  key={e.id}
                  onClick={() => onOpenAppointment(e.id)}
                  className="absolute left-1 right-1 overflow-hidden rounded-md border px-1.5 py-1 text-left transition-shadow hover:shadow-md"
                  style={{ top, height, background: c.bg, borderColor: c.border, borderLeft: `3px solid ${c.dot}` }}
                >
                  <div className="truncate text-[11px] font-semibold" style={{ color: c.text }}>{e.title}</div>
                  {height > 32 && (
                    <div className="truncate text-[10px] text-gray-500">{e.timeLabel} · {e.name}</div>
                  )}
                  {e.status === "canceled" && (
                    <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: c.text }}>Canceled</div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        {/* Now line on today column */}
        <div
          className="pointer-events-none absolute z-10 flex items-center"
          style={{ top: (10.5 - 8) * HOUR_H, left: `calc(4rem + ${(3 / 7) * 100}% * 0.999)`, right: 0 }}
        >
          <div className="h-2 w-2 -ml-1 rounded-full bg-rose-500" />
          <div className="h-px flex-1 bg-rose-500/70" style={{ maxWidth: "14.28%" }} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-gray-100 px-4 py-2.5">
        {(Object.keys(TYPE_COLORS) as (keyof typeof TYPE_COLORS)[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLORS[k].dot }} />
            {TYPE_COLORS[k].label}
          </span>
        ))}
        <span className="ml-auto text-[11px] text-gray-400">Eastern Time (EDT)</span>
      </div>
    </div>
  );
}
