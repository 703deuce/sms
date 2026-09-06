"use client";
import React from "react";
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from "lucide-react";

type Props = {
  rangeLabel: string;
  view: "day" | "week" | "month";
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onViewChange: (v: "day" | "week" | "month") => void;
  onNewAppointment: () => void;
};

const views = ["day", "week", "month"] as const;

export default function CalendarHeader({ rangeLabel, view, onToday, onPrev, onNext, onViewChange, onNewAppointment }: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2.5 mr-auto">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
          <CalendarDays className="h-[18px] w-[18px]" />
        </div>
        <div>
          <h1 className="text-[17px] font-semibold leading-tight text-gray-900">Calendar</h1>
          <p className="text-[12px] text-gray-500">{rangeLabel}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-gray-200 bg-white shadow-sm">
          <button onClick={onPrev} aria-label="Previous" className="flex h-8 w-8 items-center justify-center rounded-l-lg text-gray-500 hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={onToday} className="h-8 border-x border-gray-200 px-3 text-[13px] font-medium text-gray-700 hover:bg-gray-50">
            Today
          </button>
          <button onClick={onNext} aria-label="Next" className="flex h-8 w-8 items-center justify-center rounded-r-lg text-gray-500 hover:bg-gray-50">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
          {views.map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`h-7 rounded-md px-3 text-[13px] font-medium capitalize transition-colors ${
                view === v ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          onClick={onNewAppointment}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New appointment
        </button>
      </div>
    </div>
  );
}
