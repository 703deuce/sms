"use client";
import React from "react";
import { Plus } from "lucide-react";
import { TYPE_COLORS, WEEK_EVENTS } from "../mock-data";

type Props = {
  onOpenAppointment: (id: string) => void;
  onSelectDay: (key: string) => void;
  onNewForDay: (day: number) => void;
  onShowCalendarSettings: () => void;
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthCalendar({ onOpenAppointment, onSelectDay, onNewForDay }: Props) {
  const cells: { day: number; muted: boolean }[] = [];
  for (let i = 0; i < 2; i++) cells.push({ day: 30 + i, muted: true });
  for (let d = 1; d <= 30; d++) cells.push({ day: d, muted: false });
  while (cells.length < 35) cells.push({ day: cells.length - 32, muted: true });

  const eventsByDay: Record<number, typeof WEEK_EVENTS> = {};
  const placements: Record<number, string[]> = {
    3: ["1"], 8: ["3"], 10: ["4"], 14: ["2"], 15: ["1"], 16: ["3", "4"], 17: ["5", "6", "7"], 18: ["8", "9"], 19: ["10"], 22: ["2"], 25: ["8"], 29: ["1"],
  };
  Object.entries(placements).forEach(([day, ids]) => {
    eventsByDay[Number(day)] = WEEK_EVENTS.filter((e) => ids.includes(e.id));
  });

  return (
    <div className="card week-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DOW.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          const evts = c.muted ? [] : eventsByDay[c.day] || [];
          const isToday = !c.muted && c.day === 17;
          return (
            <div
              key={i}
              onClick={() => !c.muted && onSelectDay(`2026-09-${c.day}`)}
              className={`group min-h-[104px] cursor-pointer border-b border-r border-gray-100 p-1.5 transition-colors last:border-r-0 hover:bg-gray-50 ${c.muted ? "bg-gray-50/50" : ""} ${isToday ? "bg-indigo-50/40" : ""}`}
            >
              <div className="flex items-center justify-between">
                <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${isToday ? "bg-indigo-600 text-white" : c.muted ? "text-gray-300" : "text-gray-700"}`}>
                  {c.day}
                </div>
                {!c.muted && (
                  <button
                    aria-label={`New appointment on Sep ${c.day}`}
                    onClick={(ev) => { ev.stopPropagation(); onNewForDay(c.day); }}
                    className="flex h-5 w-5 items-center justify-center rounded text-gray-300 opacity-0 transition-opacity hover:bg-indigo-50 hover:text-indigo-600 group-hover:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="space-y-0.5">
                {evts.slice(0, 3).map((e) => {
                  const col = TYPE_COLORS[e.type];
                  return (
                    <button
                      key={e.id}
                      onClick={(ev) => { ev.stopPropagation(); onOpenAppointment(e.id); }}
                      className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium"
                      style={{ background: col.bg, color: col.text }}
                    >
                      {e.timeLabel} {e.title}
                    </button>
                  );
                })}
                {evts.length > 3 && <div className="px-1 text-[10px] text-gray-400">+{evts.length - 3} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
