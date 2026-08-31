"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, List, PieChart, X, Check, User } from "lucide-react";
import type { AudienceSelection } from "@/lib/campaigns/compose-draft";
import { loadAudiencePickerItems, type AudiencePickerItem } from "../campaign-flow-utils";

export type AudienceChip = AudienceSelection;

const groupIcons = {
  everyone: Users,
  lists: List,
  segments: PieChart,
  contacts: User,
} as const;

export default function AudiencePicker({
  selected,
  onChange,
}: {
  selected: AudienceChip[];
  onChange: (c: AudienceChip[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<AudiencePickerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudiencePickerItems()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (item: AudienceChip) => {
    if (selected.find((s) => s.id === item.id)) {
      onChange(selected.filter((s) => s.id !== item.id));
    } else {
      onChange([...selected, item]);
    }
  };

  const isSel = (id: string) => !!selected.find((s) => s.id === id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q));
  }, [items, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AudiencePickerItem[]>();
    for (const item of filtered) {
      const list = groups.get(item.group) || [];
      list.push(item);
      groups.set(item.group, list);
    }
    return groups;
  }, [filtered]);

  const Row = ({ item }: { item: AudiencePickerItem }) => {
    const Icon = groupIcons[item.group as keyof typeof groupIcons] || List;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => toggle(item)}
        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] transition-colors ${
          isSel(item.id) ? "bg-indigo-50 text-indigo-700 font-medium" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span className={`flex h-6 w-6 items-center justify-center rounded-md ${isSel(item.id) ? "bg-indigo-100" : "bg-slate-100"}`}>
          <Icon className={`w-3.5 h-3.5 ${isSel(item.id) ? "text-indigo-600" : "text-slate-400"}`} />
        </span>
        <span className="flex-1 text-left">{item.name}</span>
        {isSel(item.id) && <Check className="w-3.5 h-3.5 text-indigo-600" />}
      </button>
    );
  };

  const groupLabel = (group: string) => {
    if (group === "everyone") return "Everyone";
    if (group === "lists") return "Lists";
    if (group === "segments") return "Segments";
    if (group === "contacts") return "Contacts";
    return group;
  };

  return (
    <div className="relative">
      <div
        className="input-field flex flex-wrap items-center gap-1.5 cursor-text min-h-[42px] !py-1.5"
        onClick={() => setOpen(!open)}
      >
        {selected.map((s) => (
          <span key={s.id} className="chip">
            <List className="w-3 h-3" /> {s.name}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggle(s); }}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length ? "" : "Search lists, segments…"}
          className="flex-1 min-w-[80px] outline-none text-sm bg-transparent"
        />
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2.5 fade-in max-h-64 overflow-y-auto">
          {loading ? (
            <p className="px-2 py-3 text-[13px] text-slate-400">Loading audiences…</p>
          ) : grouped.size === 0 ? (
            <p className="px-2 py-3 text-[13px] text-slate-400">No audiences found.</p>
          ) : (
            Array.from(grouped.entries()).map(([group, rows]) => (
              <div key={group}>
                <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 px-2 mb-1 mt-2 first:mt-0">
                  {groupLabel(group)}
                </p>
                {rows.map((item) => <Row key={item.id} item={item} />)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
