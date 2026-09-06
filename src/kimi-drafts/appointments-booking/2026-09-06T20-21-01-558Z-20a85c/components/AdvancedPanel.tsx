"use client";

import React, { useState } from "react";
import { ChevronDown, Clock, CalendarX, Timer } from "lucide-react";

const rows = [
  {
    id: "hours",
    icon: Clock,
    name: "Availability",
    sub: "Weekly hours, date overrides, and blackout dates",
    body: "Mon–Fri 9:00 AM–12:00 PM and 2:00 PM–5:00 PM · 2 date overrides · 1 blackout date (Dec 25). Manage reusable schedules in Booking → Availability.",
  },
  {
    id: "notice",
    icon: Timer,
    name: "Booking rules",
    sub: "Minimum notice, maximum horizon, and buffers",
    body: "Minimum notice: 4 hours · Customers can book up to 60 days ahead · 15 min buffer before and after each appointment.",
  },
  {
    id: "questions",
    icon: CalendarX,
    name: "Booking questions",
    sub: "Custom fields customers answer when booking",
    body: "3 active questions: Reason for visit (required), Insurance provider (optional), New patient? (checkbox).",
  },
];

export default function AdvancedPanel() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="bk-card" aria-labelledby="bk-adv-title">
      <h2 id="bk-adv-title" className="bk-card-title">
        Advanced booking settings
      </h2>
      <p className="bk-card-desc">
        Availability, booking rules, and customer questions. Changes here apply
        to all booking types unless overridden.
      </p>

      <div className="mt-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const expanded = open === row.id;
          return (
            <div key={row.id} className="bk-adv-row">
              <button
                type="button"
                className="bk-adv-toggle"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : row.id)}
              >
                <span className="flex items-center gap-3">
                  <Icon size={15} className="text-gray-400" strokeWidth={2} />
                  <span>
                    <span className="bk-adv-name block">{row.name}</span>
                    <span className="bk-adv-sub block">{row.sub}</span>
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  className={`text-gray-400 transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              </button>
              {expanded && (
                <div className="bk-adv-body">
                  <p className="text-[12.5px] leading-relaxed text-gray-600">
                    {row.body}
                  </p>
                  <button
                    type="button"
                    className="mt-3 inline-flex h-7 items-center rounded-md border border-gray-200 bg-white px-2.5 text-[12px] font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                  >
                    Manage {row.name.toLowerCase()}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
