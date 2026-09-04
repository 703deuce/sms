import { Globe, Clock, CalendarDays, CalendarRange, Sparkles } from "lucide-react";
import type { SummaryItem } from "@/features/appointments/kimi/availability/types";

const ICONS = {
  globe: Globe,
  clock: Clock,
  calendar: CalendarDays,
  "calendar-range": CalendarRange,
  sparkles: Sparkles,
};

export default function AvailabilitySummary({ items }: { items: SummaryItem[] }) {
  return (
    <aside className="avail-card avail-fade-in avail-fade-in-1 p-5">
      <h3 className="text-[14px] font-semibold text-[#1c1a2e]">Availability summary</h3>
      <p className="text-[12px] text-[#8a87a0] mt-0.5 mb-4">Overview of your current settings.</p>

      <div className="space-y-1">
        {items.map((item, i) => {
          const Icon = ICONS[item.icon];
          return (
            <div
              key={item.title}
              className={`flex items-center gap-3 py-2.5 ${
                i < items.length - 1 ? "border-b border-[#f2f1f7]" : ""
              }`}
            >
              <span
                className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center shrink-0"
                style={{ background: item.bg, color: item.color }}
              >
                <Icon size={15} />
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-[#1c1a2e]">{item.title}</div>
                <div className="text-[12px] text-[#8a87a0] truncate">{item.value}</div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
