"use client";
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MINI_MONTH } from "../mock-data";

type Props = {
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (key: string) => void;
};

const DOW = ["S", "M", "T", "W", "T", "F", "S"];

export default function MiniCalendar({ onPrev, onNext, onSelectDay }: Props) {
  const { monthLabel, days, leadMuted, trailMuted } = MINI_MONTH;
  const cells: { day: number; muted: boolean; selected?: boolean; hasEvent?: boolean }[] = [
    ...leadMuted.map((d) => ({ day: d, muted: true })),
    ...days,
    ...trailMuted.map((d) => ({ day: d, muted: true })),
  ];
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-gray-900">{monthLabel}</span>
        <div className="flex items-center gap-0.5">
          <button onClick={onPrev} aria-label="Previous month" className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={onNext} aria-label="Next month" className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {DOW.map((d, i) => (
          <div key={i} className="py-1 text-center text-[10px] font-semibold text-gray-400">{d}</div>
        ))}
        {cells.map((c, i) => (
          <button
            key={i}
            onClick={() => !c.muted && onSelectDay(`day-${c.day}`)}
            className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[12px] transition-colors ${
              c.selected
                ? "bg-indigo-600 font-semibold text-white"
                : c.muted
                  ? "text-gray-300"
                  : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {c.day}
            {c.hasEvent && !c.selected && (
              <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-indigo-400" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
