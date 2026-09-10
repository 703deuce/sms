"use client";

import { Search, MoreHorizontal, CalendarDays, ChevronUp, ChevronDown } from "lucide-react";
import type { AppointmentTypeItem } from "@/features/appointments/kimi/appointment-types/types";
import {
  BOOKING_TYPE_KIND_LABELS,
  bookingTypeKindBadgeClass,
} from "@/lib/appointments/booking-type-kind";

interface Props {
  types: AppointmentTypeItem[];
  totalCount: number;
  selectedId: string | null;
  searchQuery: string;
  onSelect: (id: string) => void;
  showInactive: boolean;
  onToggleInactive: () => void;
  onSearchChange: (query: string) => void;
  onMoveType?: (id: string, direction: "up" | "down") => void;
}

export default function TypeListPanel({
  types,
  totalCount,
  selectedId,
  searchQuery,
  onSelect,
  showInactive,
  onToggleInactive,
  onSearchChange,
  onMoveType,
}: Props) {
  return (
    <div className="card flex flex-col w-[300px] shrink-0 overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[14.5px] font-semibold">All appointment types</h2>
          <span className="text-[11px] font-semibold bg-[#eef0ff] text-[#147d74] rounded-full px-2 py-0.5">
            {totalCount}
          </span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a0a3b5]" />
          <input
            className="input w-full pl-8 text-[13px]"
            placeholder="Search types..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {types.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12.5px] text-[#8a8fa3]">No appointment types match.</p>
        ) : (
          types.map((t, index) => {
            const selected = t.id === selectedId;
            return (
              <div
                key={t.id}
                className={`flex items-center gap-1 rounded-xl ${
                  selected ? "bg-[#f0efff] ring-1 ring-[#dcd9ff]" : "hover:bg-[#f7f8fa]"
                }`}
              >
                {onMoveType ? (
                  <div className="flex flex-col pl-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      className="p-0.5 text-[#a0a3b5] disabled:opacity-30"
                      onClick={() => onMoveType(t.id, "up")}
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={index === types.length - 1}
                      className="p-0.5 text-[#a0a3b5] disabled:opacity-30"
                      onClick={() => onMoveType(t.id, "down")}
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => onSelect(t.id)}
                  className="flex flex-1 items-center gap-3 px-2 py-2.5 text-left"
                >
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${t.bg} ${t.color}`}>
                  <CalendarDays size={16} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="block text-[13px] font-semibold truncate">{t.name}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ring-1 ring-inset ${bookingTypeKindBadgeClass(t.kind)}`}
                    >
                      {BOOKING_TYPE_KIND_LABELS[t.kind]}
                    </span>
                  </span>
                  <span className="block text-[11.5px] text-[#8a8fa3]">
                    {t.durationMin} min • {t.free ? "Free" : `$${t.price}`}
                  </span>
                </span>
                <span className={t.active ? "badge-active" : "badge-inactive"}>
                  {t.active ? "Active" : "Inactive"}
                </span>
                <MoreHorizontal size={16} className="text-[#a0a3b5] shrink-0 mr-2" />
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-[#ecedf2] px-4 py-3 flex items-center justify-between">
        <span className="text-[12.5px] text-[#8a8fa3]">Show inactive types</span>
        <button
          type="button"
          className={`toggle ${showInactive ? "on" : ""}`}
          onClick={onToggleInactive}
          aria-label="Toggle inactive"
        />
      </div>
    </div>
  );
}
