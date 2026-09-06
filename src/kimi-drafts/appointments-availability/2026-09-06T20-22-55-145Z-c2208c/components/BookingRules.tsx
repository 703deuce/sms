"use client";

import { Globe2, Timer, CalendarClock, ChevronDown } from "lucide-react";
import { TIMEZONES } from "../mock-data";

type Props = {
  timezone: string;
  minimumNotice: number;
  maximumDays: number;
  onTimezoneChange: (v: string) => void;
  onMinimumNoticeChange: (v: number) => void;
  onMaximumDaysChange: (v: number) => void;
};

const NOTICE_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 1440, label: "24 hours" },
];

const HORIZON_OPTIONS = [7, 14, 30, 60, 90];

export default function BookingRules({
  timezone,
  minimumNotice,
  maximumDays,
  onTimezoneChange,
  onMinimumNoticeChange,
  onMaximumDaysChange,
}: Props) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-1">
      <div className="px-6 pt-5 pb-4 border-b border-[#f0eef6]">
        <h2 className="text-[15px] font-bold tracking-tight">Booking rules</h2>
        <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
          Global constraints applied to every booking type unless overridden.
        </p>
      </div>
      <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="avail-tz" className="avail-label flex items-center gap-1.5">
            <Globe2 size={12} className="text-[#5b45e0]" /> Timezone
          </label>
          <div className="relative">
            <select
              id="avail-tz"
              className="avail-select appearance-none pr-8"
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a87a0] pointer-events-none" />
          </div>
          <p className="avail-hint">All hours below use this timezone.</p>
        </div>
        <div>
          <label htmlFor="avail-notice" className="avail-label flex items-center gap-1.5">
            <Timer size={12} className="text-[#16a05a]" /> Minimum notice
          </label>
          <div className="relative">
            <select
              id="avail-notice"
              className="avail-select appearance-none pr-8"
              value={minimumNotice}
              onChange={(e) => onMinimumNoticeChange(Number(e.target.value))}
            >
              {NOTICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a87a0] pointer-events-none" />
          </div>
          <p className="avail-hint">Earliest a customer can book from now.</p>
        </div>
        <div>
          <label htmlFor="avail-horizon" className="avail-label flex items-center gap-1.5">
            <CalendarClock size={12} className="text-[#2f6fd0]" /> Booking horizon
          </label>
          <div className="relative">
            <select
              id="avail-horizon"
              className="avail-select appearance-none pr-8"
              value={maximumDays}
              onChange={(e) => onMaximumDaysChange(Number(e.target.value))}
            >
              {HORIZON_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} days ahead
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a87a0] pointer-events-none" />
          </div>
          <p className="avail-hint">How far into the future customers can book.</p>
        </div>
      </div>
    </section>
  );
}
