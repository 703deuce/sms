"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, List, PieChart, X, Check, User } from "lucide-react";
import type { AudienceSelection } from "@/lib/campaigns/compose-draft";
import { loadAudiencePickerItems, type AudiencePickerItem } from "@/lib/campaigns/kimi-campaigns-adapter";

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
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 ${
          isSel(item.id) ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${
            isSel(item.id) ? "bg-indigo-100 ring-indigo-200/60" : "bg-slate-100 ring-slate-200/60"
          }`}
        >
          <Icon className={`h-3.5 w-3.5 ${isSel(item.id) ? "text-indigo-600" : "text-slate-400"}`} />
        </span>
        <span className="flex-1 truncate text-left">{item.name}</span>
        {isSel(item.id) && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
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
        className="input-field flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 !py-1.5"
        onClick={() => setOpen(!open)}
      >
        {selected.map((s) => (
          <span key={s.id} className="chip">
            <List className="h-3 w-3" /> {s.name}
            <button
              type="button"
              aria-label={`Remove ${s.name}`}
              onClick={(e) => { e.stopPropagation(); toggle(s); }}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length ? "" : "Search lists, segments…"}
          className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      {open && (
        <div className="fade-in absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {loading ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[13px] text-slate-400">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              Loading audiences…
            </div>
          ) : grouped.size === 0 ? (
            <p className="px-2 py-3 text-[13px] text-slate-400">No audiences found.</p>
          ) : (
            Array.from(grouped.entries()).map(([group, rows]) => (
              <div key={group}>
                <p className="mb-1 mt-2 px-2 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 first:mt-0">
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
