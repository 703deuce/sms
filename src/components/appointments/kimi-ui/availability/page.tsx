"use client";

import { Clock, BookOpen } from "lucide-react";
import BookingRules from "./components/BookingRules";
import WeeklyHours from "./components/WeeklyHours";
import DateOverrides from "./components/DateOverrides";
import AvailabilitySummary from "./components/AvailabilitySummary";
import LivePreview from "./components/LivePreview";
import "./reference.css";

export default function AvailabilityPage() {
  return (
    <div className="avail-page min-h-full bg-[#f7f6fb] text-[#1c1a2e]">
      <div className="max-w-[1240px] mx-auto px-8 py-7">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6 avail-fade-in">
          <div className="flex items-start gap-3.5">
            <span className="w-10 h-10 rounded-full bg-[#efecfd] text-[#5b45e0] flex items-center justify-center mt-0.5">
              <Clock size={20} />
            </span>
            <div>
              <h1 className="text-[22px] font-bold tracking-tight">Availability</h1>
              <p className="text-[13px] text-[#8a87a0] mt-0.5">
                Control when customers can book. Public booking, manual booking, and slot validation all use these rules.
              </p>
            </div>
          </div>
          <button className="avail-btn-ghost !bg-white border !border-[#eceaf3] shadow-sm">
            <BookOpen size={13} />
            Learn about availability
          </button>
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
          <div className="space-y-5">
            <BookingRules />
            <WeeklyHours />
            <DateOverrides />

            {/* Footer save bar */}
            <div className="avail-card avail-fade-in avail-fade-in-3 flex items-center justify-between px-[22px] py-4">
              <p className="text-[12.5px] text-[#8a87a0]">
                Changes apply immediately to all booking channels.
              </p>
              <button className="avail-btn-primary">Save availability</button>
            </div>
          </div>

          <div className="space-y-5">
            <AvailabilitySummary />
            <LivePreview />
          </div>
        </div>
      </div>
    </div>
  );
}
