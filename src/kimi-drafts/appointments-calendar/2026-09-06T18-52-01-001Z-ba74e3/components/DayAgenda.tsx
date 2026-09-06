"use client";
import React from "react";
import { ArrowRight } from "lucide-react";
import { AGENDA_ITEMS } from "../mock-data";

type Props = {
  onOpenAppointment: (id: string) => void;
  onViewFullDay: () => void;
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  canceled: "bg-rose-50 text-rose-700",
};

export default function DayAgenda({ onOpenAppointment, onViewFullDay }: Props) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-gray-900">Wednesday, Sep 17</div>
          <div className="text-[11px] text-gray-400">{AGENDA_ITEMS.length} appointments</div>
        </div>
        <button onClick={onViewFullDay} className="flex items-center gap-1 text-[12px] font-medium text-indigo-600 hover:text-indigo-500">
          Full day <ArrowRight className="h-3 w-3" />
        </button>
      </div>
      <div className="space-y-2">
        {AGENDA_ITEMS.map((a) => (
          <button
            key={a.id}
            onClick={() => onOpenAppointment(a.id)}
            className="flex w-full items-start gap-2.5 rounded-lg border border-gray-100 p-2.5 text-left transition-colors hover:border-gray-200 hover:bg-gray-50"
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: a.dot }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-gray-900">{a.title}</div>
              <div className="text-[11px] text-gray-500">{a.time} · {a.duration} · {a.name}</div>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${STATUS_STYLES[a.status]}`}>
              {a.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
