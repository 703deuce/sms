"use client";

import { Search } from "lucide-react";
import type { StaffListItem } from "@/features/appointments/kimi/staff/types";

type Props = {
  staff: StaffListItem[];
  totalCount: number;
  selectedId: string | null;
  searchQuery: string;
  onSelect: (id: string) => void;
  onSearchChange: (value: string) => void;
};

export default function StaffListPanel({
  staff,
  totalCount,
  selectedId,
  searchQuery,
  onSelect,
  onSearchChange,
}: Props) {
  return (
    <div className="card flex flex-col h-full min-h-[560px] w-full">
      <div className="px-4 pt-4 pb-3 border-b border-[#ecedf2]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#1a1d29]">Team members</h2>
          <span className="text-[12px] text-[#8a8fa3]">{totalCount}</span>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8fa3]" />
          <input
            className="input w-full pl-9"
            placeholder="Search staff…"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search staff"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {staff.length === 0 ? (
          <p className="px-3 py-8 text-center text-[13px] text-[#8a8fa3]">No staff match your search.</p>
        ) : (
          staff.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onSelect(member.id)}
              className={`staff-list-item w-full rounded-xl px-3 py-3 text-left ${
                selectedId === member.id ? "selected" : "hover:bg-[#f7f8fb]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-[13.5px] font-semibold truncate ${
                      member.active ? "text-[#1a1d29]" : "text-[#8a8fa3] line-through"
                    }`}
                  >
                    {member.name}
                  </p>
                  <p className="text-[11.5px] text-[#8a8fa3] mt-0.5">
                    {member.typeCount} types · {member.locationCount} locations
                  </p>
                </div>
                <span className={member.active ? "badge-active" : "badge-inactive"}>
                  {member.active ? "Active" : "Inactive"}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
