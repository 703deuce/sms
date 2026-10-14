"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Users, List, PieChart, X, Check, User } from "lucide-react";
import type { AudienceSelection } from "@/lib/campaigns/compose-draft";
import { campaignsOpusFieldClass } from "@/newui-transplant/components/campaigns/campaigns-opus-field";
import {
  loadAudiencePickerCatalog,
  searchAudienceContacts,
  type AudiencePickerItem,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { formatPhone } from "@/lib/utils";

export type AudienceChip = AudienceSelection;

const groupIcons = {
  everyone: Users,
  lists: List,
  segments: PieChart,
  contacts: User,
} as const;

function chipLabel(item: AudienceSelection): string {
  if (item.type === "contact" && item.phone) {
    const phone = formatPhone(item.phone);
    return item.name && item.name !== item.phone ? `${item.name} · ${phone}` : phone;
  }
  return item.name;
}

function chipIcon(item: AudienceSelection) {
  if (item.type === "contact") return User;
  if (item.type === "segment") return PieChart;
  if (item.type === "all") return Users;
  return List;
}

export default function AudiencePicker({
  selected,
  onChange,
  mode = "include",
}: {
  selected: AudienceChip[];
  onChange: (c: AudienceChip[]) => void;
  mode?: "include" | "exclude";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [catalogItems, setCatalogItems] = useState<AudiencePickerItem[]>([]);
  const [contactItems, setContactItems] = useState<AudiencePickerItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    loadAudiencePickerCatalog()
      .then(setCatalogItems)
      .catch(() => setCatalogItems([]))
      .finally(() => setLoadingCatalog(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoadingContacts(true);
      searchAudienceContacts(query)
        .then((items) => {
          if (!cancelled) setContactItems(items);
        })
        .catch(() => {
          if (!cancelled) setContactItems([]);
        })
        .finally(() => {
          if (!cancelled) setLoadingContacts(false);
        });
    }, query.trim() ? 200 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const items = useMemo(() => [...catalogItems, ...contactItems], [catalogItems, contactItems]);
  const loading = loadingCatalog || loadingContacts;

  const toggle = (item: AudiencePickerItem) => {
    if (selected.find((s) => s.id === item.id)) {
      onChange(selected.filter((s) => s.id !== item.id));
      return;
    }
    onChange([
      ...selected,
      {
        type: item.type,
        id: item.id,
        name: item.name,
        count: item.count,
        phone: item.phone,
      },
    ]);
  };

  const isSel = (id: string) => !!selected.find((s) => s.id === id);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.name, item.phone, item.phone ? formatPhone(item.phone) : ""]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const grouped = useMemo(() => {
    const order = ["everyone", "lists", "segments", "contacts"];
    const groups = new Map<string, AudiencePickerItem[]>();
    for (const item of filtered) {
      const list = groups.get(item.group) || [];
      list.push(item);
      groups.set(item.group, list);
    }
    return order
      .filter((group) => groups.has(group))
      .map((group) => [group, groups.get(group)!] as const);
  }, [filtered]);

  const Row = ({ item }: { item: AudiencePickerItem }) => {
    const Icon = groupIcons[item.group as keyof typeof groupIcons] || List;
    const selectedRow = isSel(item.id);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => toggle(item)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 ${
          selectedRow ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${
            selectedRow ? "bg-indigo-100 ring-indigo-200/60" : "bg-slate-100 ring-slate-200/60"
          }`}
        >
          <Icon className={`h-3.5 w-3.5 ${selectedRow ? "text-indigo-600" : "text-slate-400"}`} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{item.name}</span>
          {item.phone ? (
            <span className="block truncate text-[11px] font-normal tabular-nums text-slate-400">
              {formatPhone(item.phone)}
            </span>
          ) : item.count != null && item.count > 0 ? (
            <span className="block truncate text-[11px] font-normal text-slate-400">
              {item.count.toLocaleString()} contacts
            </span>
          ) : null}
        </span>
        {selectedRow && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
      </button>
    );
  };

  const groupLabel = (group: string) => {
    if (group === "everyone") return "Everyone";
    if (group === "lists") return "Lists";
    if (group === "segments") return "Segments";
    if (group === "contacts") return "Individual contacts";
    return group;
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const root = document.getElementById(`audience-picker-root-${mode}`);
      if (root?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, mode]);

  const placeholder =
    mode === "exclude"
      ? selected.length
        ? ""
        : "Exclude lists, segments, or contacts…"
      : selected.length
        ? ""
        : "Search lists, segments, or contacts by name or number…";

  return (
    <div className="relative" id={`audience-picker-root-${mode}`}>
      <div
        className={`${campaignsOpusFieldClass} flex min-h-[42px] h-auto cursor-text flex-wrap items-center gap-1.5 py-1.5 ${
          mode === "exclude" ? "border-rose-200/80 bg-rose-50/30" : ""
        }`}
        onClick={() => setOpen(!open)}
      >
        {selected.map((s) => {
          const ChipIcon = chipIcon(s);
          return (
            <span key={s.id} className="chip max-w-full">
              <ChipIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{chipLabel(s)}</span>
              <button
                type="button"
                aria-label={`Remove ${chipLabel(s)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(selected.filter((chip) => chip.id !== s.id));
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
      </div>
      {open && (
        <div className="fade-in absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          {loading && grouped.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[13px] text-slate-400">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
              Loading audiences…
            </div>
          ) : grouped.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-slate-400">
              No audiences found. Try another name or phone number.
            </p>
          ) : (
            grouped.map(([group, rows]) => (
              <div key={group}>
                <p className="mb-1 mt-2 px-2 text-[10px] font-bold uppercase tracking-[0.07em] text-slate-400 first:mt-0">
                  {groupLabel(group)}
                </p>
                {rows.map((item) => (
                  <Row key={item.id} item={item} />
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
