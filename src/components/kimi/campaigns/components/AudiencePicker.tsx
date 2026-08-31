"use client";
import { useState } from "react";
import { Search, Users, List, PieChart, X, Check } from "lucide-react";
import { audienceOptions } from "../mock-data";

export type AudienceChip = { id: string; label: string };

export default function AudiencePicker({ selected, onChange }: { selected: AudienceChip[]; onChange: (c: AudienceChip[]) => void }) {
  const [open, setOpen] = useState(false);

  const toggle = (item: AudienceChip) => {
    if (selected.find((s) => s.id === item.id)) onChange(selected.filter((s) => s.id !== item.id));
    else onChange([...selected, item]);
  };

  const isSel = (id: string) => !!selected.find((s) => s.id === id);

  const Row = ({ icon: Icon, item }: { icon: any; item: AudienceChip }) => (
    <button
      key={item.id}
      onClick={() => toggle(item)}
      className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
        isSel(item.id) ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-md ${isSel(item.id) ? "bg-indigo-100" : "bg-slate-100"}`}>
        <Icon className={`w-3.5 h-3.5 ${isSel(item.id) ? "text-indigo-600" : "text-slate-400"}`} />
      </span>
      <span className="flex-1 text-left">{item.label}</span>
      {isSel(item.id) && <Check className="w-3.5 h-3.5 text-indigo-600" />}
    </button>
  );

  return (
    <div className="relative">
      <div
        className="input-field flex flex-wrap items-center gap-1.5 cursor-text min-h-[42px] !py-1.5"
        onClick={() => setOpen(!open)}
      >
        {selected.map((s) => (
          <span key={s.id} className="chip">
            <List className="w-3 h-3" /> {s.label}
            <button onClick={(e) => { e.stopPropagation(); toggle(s); }}><X className="w-3 h-3" /></button>
          </span>
        ))}
        <input placeholder={selected.length ? "" : "Search lists, segments…"} className="flex-1 min-w-[80px] outline-none text-sm bg-transparent" />
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2.5 fade-in max-h-64 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 px-2 mb-1">Everyone</p>
          {audienceOptions.everyone.map((o) => <Row key={o.id} icon={Users} item={o} />)}
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 px-2 mt-3 mb-1">Lists</p>
          {audienceOptions.lists.map((o) => <Row key={o.id} icon={List} item={o} />)}
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 px-2 mt-3 mb-1">Segments</p>
          {audienceOptions.segments.map((o) => <Row key={o.id} icon={PieChart} item={o} />)}
        </div>
      )}
    </div>
  );
}
