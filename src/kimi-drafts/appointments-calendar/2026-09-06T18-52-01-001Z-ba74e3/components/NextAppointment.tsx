"use client";
import React from "react";
import { Clock, Video, Phone, ArrowUpRight } from "lucide-react";
import { NEXT_APPOINTMENT } from "../mock-data";

type Props = { onOpenAppointment: (id: string) => void };

export default function NextAppointment({ onOpenAppointment }: Props) {
  const a = NEXT_APPOINTMENT;
  return (
    <div className="card overflow-hidden">
      <div className="border-b border-indigo-100 bg-indigo-50/70 px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Next appointment · {a.inLabel}</span>
      </div>
      <div className="p-4">
        <div className="text-[15px] font-semibold text-gray-900">{a.title}</div>
        <div className="mt-0.5 text-[13px] text-gray-600">{a.name}</div>
        <div className="mt-3 space-y-1.5 text-[12px] text-gray-500">
          <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-gray-400" /> {a.time} ({a.duration})</div>
          <div className="flex items-center gap-2"><Video className="h-3.5 w-3.5 text-gray-400" /> {a.method}</div>
          <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-gray-400" /> {a.phone}</div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => onOpenAppointment(a.id)}
            className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 text-[13px] font-semibold text-white hover:bg-indigo-500"
          >
            Open <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 capitalize">{a.status}</span>
        </div>
      </div>
    </div>
  );
}
