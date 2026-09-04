import { ArrowRight } from "lucide-react";
import type { PreviewDayRow } from "@/features/appointments/kimi/availability/types";

export default function LivePreview({ days }: { days: PreviewDayRow[] }) {
  return (
    <aside className="avail-card avail-fade-in avail-fade-in-2 p-5">
      <h3 className="text-[14px] font-semibold text-[#1c1a2e]">Live availability preview</h3>
      <p className="text-[12px] text-[#8a87a0] mt-0.5 mb-4">
        See upcoming availability based on your rules.
      </p>

      <div className="space-y-1">
        {days.map((d) => (
          <div key={d.date} className="flex items-start justify-between py-2.5">
            <div>
              {d.label && (
                <div className="text-[12.5px] font-semibold text-[#1c1a2e]">{d.label}</div>
              )}
              <div className={`text-[12.5px] ${d.label ? "text-[#8a87a0]" : "font-medium text-[#4a4763]"}`}>
                {d.date}
              </div>
            </div>
            <div className="text-right">
              {d.hours && <div className="text-[12.5px] font-medium text-[#1c1a2e]">{d.hours}</div>}
              <span
                className={`avail-pill mt-1 ${
                  d.status === "open"
                    ? "avail-pill-open"
                    : d.status === "closed"
                      ? "avail-pill-closed"
                      : "avail-pill-custom"
                }`}
              >
                {d.status === "open" ? "Open" : d.status === "closed" ? "Closed" : "Override"}
              </span>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className="mt-3 inline-flex items-center gap-2 text-[13px] font-semibold text-[#5b45e0] hover:gap-3 transition-all">
        View full calendar
        <ArrowRight size={15} />
      </button>
    </aside>
  );
}
