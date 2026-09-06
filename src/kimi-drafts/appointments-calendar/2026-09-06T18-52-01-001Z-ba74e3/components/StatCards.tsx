"use client";
import React from "react";
import { Calendar, CheckCircle2, Clock, XCircle, Users } from "lucide-react";

const ICONS = { calendar: Calendar, check: CheckCircle2, clock: Clock, x: XCircle, users: Users };
const TONES: Record<string, string> = {
  indigo: "bg-indigo-50 text-indigo-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-rose-50 text-rose-600",
  violet: "bg-violet-50 text-violet-600",
};

type Stat = { icon: keyof typeof ICONS; tone: string; value: string; label: string; delta?: string };

export default function StatCards({ stats }: { stats: readonly Stat[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {stats.map((s) => {
        const Icon = ICONS[s.icon];
        return (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONES[s.tone]}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2.5 text-[22px] font-semibold leading-none text-gray-900">{s.value}</div>
            <div className="mt-1 text-[12px] font-medium text-gray-600">{s.label}</div>
            {s.delta ? <div className="mt-0.5 text-[11px] text-gray-400">{s.delta}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
