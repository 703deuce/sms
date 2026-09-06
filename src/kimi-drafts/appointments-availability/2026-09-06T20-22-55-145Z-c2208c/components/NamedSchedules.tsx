"use client";

import { useState } from "react";
import { Layers, ChevronDown, Check, Plus } from "lucide-react";
import type { NamedSchedule } from "../mock-data";

type Props = {
  schedules: NamedSchedule[];
  activeScheduleId: string;
  onSelect: (id: string) => void;
  onSaveCurrentAs: (name: string) => void;
};

export default function NamedSchedules({ schedules, activeScheduleId, onSelect, onSaveCurrentAs }: Props) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  return (
    <section className="avail-card avail-fade-in avail-fade-in-1">
      <div className="px-6 py-4 flex flex-wrap items-center gap-4">
        <span className="w-9 h-9 rounded-lg bg-[#efecfd] text-[#5b45e0] flex items-center justify-center shrink-0">
          <Layers size={16} strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-bold tracking-tight">Availability schedule</h2>
          <p className="text-[12px] text-[#8a87a0] mt-0.5">
            Reusable schedules can be assigned to booking types. Editing updates the selected schedule.
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative">
            <select
              aria-label="Active availability schedule"
              className="avail-select appearance-none pr-8 !w-[210px]"
              value={activeScheduleId}
              onChange={(e) => onSelect(e.target.value)}
            >
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.isDefault ? " (default)" : ""} · {s.openDays}d open
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#8a87a0] pointer-events-none" />
          </div>
          {naming ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label="New schedule name"
                placeholder="Schedule name"
                className="avail-text !w-[170px]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) {
                    onSaveCurrentAs(name.trim());
                    setName("");
                    setNaming(false);
                  }
                  if (e.key === "Escape") setNaming(false);
                }}
              />
              <button
                type="button"
                className="avail-btn-mini !text-[#5b45e0] !border-[#d9d5ec] hover:!bg-[#efecfd] disabled:opacity-50"
                disabled={!name.trim()}
                onClick={() => {
                  onSaveCurrentAs(name.trim());
                  setName("");
                  setNaming(false);
                }}
              >
                <Check size={12} /> Save
              </button>
              <button type="button" className="avail-btn-mini" onClick={() => setNaming(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="avail-btn-mini" onClick={() => setNaming(true)}>
              <Plus size={12} /> Save current as new
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
