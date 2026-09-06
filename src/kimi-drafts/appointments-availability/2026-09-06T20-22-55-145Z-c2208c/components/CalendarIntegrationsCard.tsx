"use client";

import { CalendarCheck2, RefreshCw, ArrowUpRight } from "lucide-react";

const INTEGRATIONS = [
  {
    name: "Google Calendar",
    detail: "Connected · Work Calendar",
    status: "Synced 4 min ago",
    tone: "ok" as const,
  },
  {
    name: "Microsoft 365",
    detail: "Not connected",
    status: "Blocks unavailable times when connected",
    tone: "off" as const,
  },
];

export default function CalendarIntegrationsCard() {
  return (
    <section className="avail-card avail-fade-in avail-fade-in-3">
      <div className="px-6 pt-5 pb-4 border-b border-[#f0eef6] flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight">Connected calendars</h2>
          <p className="text-[12.5px] text-[#8a87a0] mt-0.5">
            Busy events on connected calendars automatically block booking slots.
          </p>
        </div>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="text-[12px] font-semibold text-[#5b45e0] hover:underline flex items-center gap-1 shrink-0 mt-0.5"
        >
          Manage integrations <ArrowUpRight size={12} />
        </a>
      </div>
      <ul className="divide-y divide-[#f3f1f8]">
        {INTEGRATIONS.map((intg) => (
          <li key={intg.name} className="px-6 py-3.5 flex items-center gap-3.5">
            <span className="w-9 h-9 rounded-lg bg-[#f4f2fa] border border-[#eceaf3] flex items-center justify-center shrink-0 text-[#5b45e0]">
              <CalendarCheck2 size={16} strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold">{intg.name}</p>
              <p className="text-[12px] text-[#8a87a0] truncate">{intg.detail}</p>
            </div>
            <span
              className={`flex items-center gap-1.5 text-[11.5px] font-medium shrink-0 ${
                intg.tone === "ok" ? "text-[#16a05a]" : "text-[#8a87a0]"
              }`}
            >
              {intg.tone === "ok" && <RefreshCw size={11} />}
              {intg.status}
            </span>
            {intg.tone === "off" && (
              <button type="button" className="avail-btn-mini shrink-0">
                Connect
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
