"use client";
import { useState } from "react";
import { Search, Users, List, Filter, X } from "lucide-react";
import { audienceOptions } from "../mock-data";

export type AudienceChip = { id: string; label: string };

export default function AudiencePicker({ selected, onChange }: { selected: AudienceChip[]; onChange: (c: AudienceChip[]) => void }) {
  const [open, setOpen] = useState(false);

  const toggle = (item: AudienceChip) => {
    if (selected.find((s) => s.id === item.id)) onChange(selected.filter((s) => s.id !== item.id));
    else onChange([...selected, item]);
  };

  return (
    <div className="relative">
      <div
        className="input-field flex flex-wrap items-center gap-1.5 cursor-text min-h-[42px]"
        onClick={() => setOpen(!open)}
      >
        {selected.map((s) => (
          <span key={s.id} className="chip">
            <List className="w-3 h-3" /> {s.label}
            <button onClick={(e) => { e.stopPropagation(); toggle(s); }}><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input placeholder={selected.length ? "" : "Search"} className="flex-1 min-w-[80px] outline-none text-sm" />
        <Search className="w-4 h-4 text-slate-400" />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-30 p-3 fade-in max-h-64 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Everyone</p>
          {audienceOptions.everyone.map((o) => (
            <button key={o.id} onClick={() => toggle(o)} className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-slate-50 text-[13px] text-slate-700">
              <Users className="w-4 h-4 text-slate-400" /> {o.label}
            </button>
          ))}
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-3 mb-1.5">Lists</p>
          {audienceOptions.lists.map((o) => (
            <button key={o.id} onClick={() => toggle(o)} className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-indigo-50 text-[13px] text-slate-700">
              <List className="w-4 h-4 text-slate-400" /> {o.label}
            </button>
          ))}
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-3 mb-1.5">Segments</p>
          {audienceOptions.segments.map((o) => (
            <button key={o.id} onClick={() => toggle(o)} className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-indigo-50 text-[13px] text-slate-700">
              <Filter className="w-4 h-4 text-slate-400" /> {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
