"use client";

import { Globe2, Clock, Calendar, CalendarRange, Sparkles } from "lucide-react";

type SummaryItem = {
  icon: "globe" | "clock" | "calendar" | "calendar-range" | "sparkles";
  bg: string;
  color: string;
  title: string;
  value: string;
};

const ICONS = {
  globe: Globe2,
  clock: Clock,
  calendar: Calendar,
  "calendar-range": CalendarRange,
  sparkles: Sparkles,
};

export default function AvailabilitySummary({ items }: { items: SummaryItem[] }) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-2">
      <div className="px-5 pt-4.5 pb-3 border-b border-[#f0eef6] pt-5">
        <h2 className="text-[13.5px] font-bold tracking-tight">Summary</h2>
      </div>
      <ul className="px-5 py-3 divide-y divide-[#f5f4f9]">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <li key={item.title} className="py-2.5 flex items-center gap-3">
              <span
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: item.bg, color: item.color }}
              >
                <Icon size={13.5} strokeWidth={2.1} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#8a87a0] leading-tight">{item.title}</p>
                <p className="text-[12.5px] font-semibold truncate leading-snug">{item.value}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
