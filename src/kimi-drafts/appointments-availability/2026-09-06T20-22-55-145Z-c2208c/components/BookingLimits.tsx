"use client";

import { Gauge, ChevronDown } from "lucide-react";

type Props = {
  maxPerDay: number;
  maxPerWeek: number;
  maxPerMonth: number;
  maxPerTypePerDay: number;
  onChange: (field: "maxPerDay" | "maxPerWeek" | "maxPerMonth" | "maxPerTypePerDay", value: number) => void;
};

const OPTIONS = [0, 2, 4, 6, 8, 10, 12, 16, 20, 25, 30, 40, 50, 75, 100, 150, 200];

function LimitSelect({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="avail-label">{label}</label>
      <div className="relative">
        <select
          id={id}
          className="avail-select appearance-none pr-8"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        >
          {OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "No limit" : `${n} appointments`}
            </option>
          ))}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a87a0] pointer-events-none" />
      </div>
      <p className="avail-hint">{hint}</p>
    </div>
  );
}

export default function BookingLimits(props: Props) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-2">
      <div className="px-6 pt-5 pb-4 border-b border-[#f0eef6]">
        <h2 className="text-[15px] font-bold tracking-tight flex items-center gap-2">
          <Gauge size={15} className="text-[#5b45e0]" /> Booking limits
        </h2>
        <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
          Cap how many appointments can be booked. Applies across all booking types and channels.
        </p>
      </div>
      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <LimitSelect
          id="limit-day"
          label="Per day"
          hint="Max total bookings in one day."
          value={props.maxPerDay}
          onChange={(v) => props.onChange("maxPerDay", v)}
        />
        <LimitSelect
          id="limit-week"
          label="Per week"
          hint="Max total bookings in one week."
          value={props.maxPerWeek}
          onChange={(v) => props.onChange("maxPerWeek", v)}
        />
        <LimitSelect
          id="limit-month"
          label="Per month"
          hint="Max total bookings in one month."
          value={props.maxPerMonth}
          onChange={(v) => props.onChange("maxPerMonth", v)}
        />
        <LimitSelect
          id="limit-type"
          label="Per booking type / day"
          hint="Cap a single type per day (e.g. consultations)."
          value={props.maxPerTypePerDay}
          onChange={(v) => props.onChange("maxPerTypePerDay", v)}
        />
      </div>
    </section>
  );
}
