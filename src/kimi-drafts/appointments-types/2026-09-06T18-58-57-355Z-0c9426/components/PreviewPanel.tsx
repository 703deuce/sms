"use client";

import { Clock, MapPin, CalendarDays } from "lucide-react";
import type { AppointmentTypeItem } from "../mock-data";

export default function PreviewPanel({ type }: { type: AppointmentTypeItem }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slots = ["9:00 AM", "10:30 AM", "1:00 PM", "2:30 PM"];

  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-[#ecedf2] flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#1a1d29]">Booking page preview</h3>
        <span className={`chip ${type.isLive ? "chip-live" : "chip-draft"}`}>{type.isLive ? "Live" : "Draft"}</span>
      </div>

      {/* Mini customer-facing preview */}
      <div className="p-4 bg-[#f7f8fb]">
        <div className="rounded-xl border border-[#ecedf2] bg-white overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="px-4 py-3.5 border-b border-[#ecedf2]">
            <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#8a8fa3]">Brightline Dental</div>
            <div className="text-[14px] font-bold text-[#1a1d29] mt-1 leading-snug">{type.name}</div>
            <div className="flex items-center gap-3 mt-1.5 text-[11.5px] text-[#667085]">
              <span className="inline-flex items-center gap-1">
                <Clock size={11} /> {type.durationMin} min
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin size={11} /> {type.location || "Online"}
              </span>
              <span className="font-semibold text-[#1a1d29]">{type.free ? "Free" : `$${type.price}`}</span>
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#3c4257] mb-2">
              <CalendarDays size={12} className="text-[#8a8fa3]" /> Select a date
            </div>
            <div className="grid grid-cols-7 gap-1 mb-3">
              {days.map((d, i) => (
                <div key={d} className="text-center">
                  <div className="text-[9.5px] text-[#a7abb9] mb-1">{d}</div>
                  <div
                    className={`mx-auto flex h-6.5 w-6.5 items-center justify-center rounded-md text-[11px] font-medium ${
                      i === 2
                        ? "bg-[#4f46e5] text-white"
                        : i < 5
                          ? "bg-[#f2f4f7] text-[#3c4257]"
                          : "text-[#c3c7d4]"
                    }`}
                    style={{ height: 26, width: 26 }}
                  >
                    {12 + i}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              {slots.map((s, i) => (
                <div
                  key={s}
                  className={`rounded-lg border px-3 py-1.5 text-[11.5px] font-medium text-center ${
                    i === 1
                      ? "border-[#4f46e5] bg-[#eef0fd] text-[#4f46e5]"
                      : "border-[#e4e6ee] text-[#3c4257]"
                  }`}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[11.5px] text-[#8a8fa3] text-center mt-3 leading-relaxed">
          This is what customers see on your public booking page.
        </p>
      </div>
    </div>
  );
}
