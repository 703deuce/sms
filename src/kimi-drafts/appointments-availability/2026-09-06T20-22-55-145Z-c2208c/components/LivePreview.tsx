"use client";

import { Eye } from "lucide-react";

type PreviewDay = {
  label: string;
  date: string;
  hours?: string;
  status: "open" | "closed" | "override";
};

export default function LivePreview({ days }: { days: PreviewDay[] }) {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-3">
      <div className="px-5 pt-5 pb-3 border-b border-[#f0eef6] flex items-center justify-between">
        <h2 className="text-[13.5px] font-bold tracking-tight">Booking preview</h2>
        <span className="flex items-center gap-1 text-[10.5px] font-semibold text-[#5b45e0] bg-[#efecfd] rounded-full px-2 py-0.5">
          <Eye size={10.5} /> Live
        </span>
      </div>
      <p className="px-5 pt-2.5 text-[11.5px] text-[#8a87a0]">What customers see over the next 5 days.</p>
      <ul className="px-5 py-3 divide-y divide-[#f5f4f9]">
        {days.map((d, i) => (
          <li key={i} className="py-2.5 flex items-center gap-3">
            <span
              className={`w-1.5 h-8 rounded-full shrink-0 ${
                d.status === "open" ? "bg-[#16a05a]" : d.status === "override" ? "bg-[#c46a1b]" : "bg-[#d5d2e2]"
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold leading-tight">
                {d.label ? <span className="text-[#5b45e0]">{d.label} · </span> : null}
                {d.date}
              </p>
              <p className="text-[11.5px] text-[#8a87a0] leading-snug truncate">
                {d.status === "closed" ? "Closed" : d.hours || "Closed"}
              </p>
            </div>
            {d.status === "override" && (
              <span className="text-[9.5px] font-bold uppercase tracking-wide text-[#c46a1b] bg-[#fdf1e4] rounded px-1.5 py-0.5 shrink-0">
                Override
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
