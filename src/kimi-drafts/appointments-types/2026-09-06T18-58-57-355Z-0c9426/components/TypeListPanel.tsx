"use client";

import { Search, ChevronUp, ChevronDown, Clock, CalendarX } from "lucide-react";
import type { AppointmentTypeItem } from "../mock-data";

type Props = {
  types: AppointmentTypeItem[];
  totalCount: number;
  selectedId: string | null;
  searchQuery: string;
  onSelect: (id: string) => void;
  showInactive: boolean;
  onToggleInactive: () => void;
  onSearchChange: (q: string) => void;
  onMoveType: (id: string, direction: "up" | "down") => void;
};

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
    <div className="panel flex flex-col w-full">
      <div className="px-4 pt-4 pb-3 border-b border-[#ecedf2]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13.5px] font-semibold text-[#1a1d29]">
            Booking types <span className="text-[#8a8fa3] font-medium">({totalCount})</span>
          </h2>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a7abb9] pointer-events-none" />
          <input
            type="search"
            className="field-input !pl-8.5 !h-8.5 text-[13px]"
            style={{ paddingLeft: 32, height: 34 }}
            placeholder="Search booking types"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search booking types"
          />
        </div>
        <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
          <button
            type="button"
            role="checkbox"
            aria-checked={showInactive}
            className="toggle"
            onClick={onToggleInactive}
            aria-label="Show inactive booking types"
          />
          <span className="text-[12.5px] text-[#667085]">Show inactive</span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto py-1.5" role="listbox" aria-label="Booking types">
        {types.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f4f7] text-[#8a8fa3]">
              <CalendarX size={18} />
            </div>
            <p className="text-[13px] font-medium text-[#3c4257]">No booking types match</p>
            <p className="text-[12px] text-[#8a8fa3] mt-1">Try a different search or filter.</p>
          </div>
        ) : (
          types.map((t) => {
            const selectedRow = t.id === selectedId;
            return (
              <div
                key={t.id}
                role="option"
                aria-selected={selectedRow}
                tabIndex={0}
                className={`type-row group flex items-center gap-3 px-4 py-3 mx-1.5 rounded-lg ${selectedRow ? "selected" : ""}`}
                onClick={() => onSelect(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(t.id);
                  }
                }}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ${t.bg} ${t.color}`}
                  aria-hidden="true"
                >
                  {t.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[13.5px] font-semibold ${t.active ? "text-[#1a1d29]" : "text-[#8a8fa3]"}`}>
                    {t.name}
                  </span>
                  <span className="flex items-center gap-2.5 mt-0.5 text-[12px] text-[#8a8fa3]">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> {t.durationMin} min
                    </span>
                    <span>{t.free ? "Free" : `$${t.price}`}</span>
                  </span>
                </span>
                <span className="flex flex-col shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    className="p-0.5 rounded text-[#a7abb9] hover:text-[#3c4257] hover:bg-[#ecedf2]"
                    aria-label={`Move ${t.name} up`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveType(t.id, "up");
                    }}
                  >
                    <ChevronUp size={13} />
                  </button>
                  <button
                    type="button"
                    className="p-0.5 rounded text-[#a7abb9] hover:text-[#3c4257] hover:bg-[#ecedf2]"
                    aria-label={`Move ${t.name} down`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveType(t.id, "down");
                    }}
                  >
                    <ChevronDown size={13} />
                  </button>
                </span>
                {!t.active && <span className="chip chip-paused shrink-0">Paused</span>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
