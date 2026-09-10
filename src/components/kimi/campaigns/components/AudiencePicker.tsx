"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, Users, List, PieChart, X, Check, User, Upload, CalendarDays } from "lucide-react";
import type { AudienceSelection } from "@/lib/campaigns/compose-draft";
import {
  loadAudiencePickerCatalog,
  searchAudienceContacts,
  type AudiencePickerItem,
} from "@/lib/campaigns/kimi-campaigns-adapter";
import { formatPhone } from "@/lib/utils";
import {
  CampaignAudienceField,
  CampaignChip,
  CampaignDropdownPanel,
} from "@/components/campaigns/campaign-ui-primitives";

export type AudienceChip = AudienceSelection;

const groupIcons = {
  everyone: Users,
  lists: List,
  segments: PieChart,
  contacts: User,
  suggested: CalendarDays,
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
  if (item.type === "appointment_preset") return CalendarDays;
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
  const [bookingTypeName, setBookingTypeName] = useState("");

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
    if (item.type === "appointment_preset" && item.id === "booking_type" && !bookingTypeName.trim()) {
      return;
    }
    const selection: AudienceSelection = {
      type: item.type,
      id: item.id,
      name: item.name,
      count: item.count,
      phone: item.phone,
      ...(item.type === "appointment_preset" && item.id === "booking_type" && bookingTypeName.trim()
        ? { bookingTypeName: bookingTypeName.trim() }
        : {}),
    };
    if (selected.find((s) => s.id === item.id && s.type === item.type)) {
      onChange(selected.filter((s) => !(s.id === item.id && s.type === item.type)));
      return;
    }
    onChange([...selected, selection]);
  };

  const isSel = (item: AudiencePickerItem) =>
    !!selected.find((s) => s.id === item.id && s.type === item.type);

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
    const order = ["everyone", "suggested", "lists", "segments", "contacts"];
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
    const selectedRow = isSel(item);
    return (
      <button
        key={`${item.type}-${item.id}`}
        type="button"
        onClick={() => toggle(item)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors duration-150 ${
          selectedRow
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground hover:bg-muted/60"
        }`}
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ${
            selectedRow ? "bg-primary/15 ring-primary/25" : "bg-muted ring-border"
          }`}
        >
          <Icon className={`h-3.5 w-3.5 ${selectedRow ? "text-primary" : "text-muted-foreground"}`} />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate">{item.name}</span>
          {item.phone ? (
            <span className="block truncate text-[11px] font-normal tabular-nums text-muted-foreground">
              {formatPhone(item.phone)}
            </span>
          ) : item.count != null && item.count > 0 ? (
            <span className="block truncate text-[11px] font-normal text-muted-foreground">
              {item.count.toLocaleString()} contacts
            </span>
          ) : null}
        </span>
        {selectedRow && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </button>
    );
  };

  const groupLabel = (group: string) => {
    if (group === "everyone") return "Everyone";
    if (group === "suggested") return "Suggested audiences";
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
        : "Search lists, segments, booking audiences, or contacts…";

  return (
    <div className="relative" id={`audience-picker-root-${mode}`}>
      <CampaignAudienceField exclude={mode === "exclude"} onClick={() => setOpen(!open)}>
        {selected.map((s) => {
          const ChipIcon = chipIcon(s);
          return (
            <CampaignChip
              key={`${s.type}-${s.id}`}
              onRemove={() => {
                onChange(selected.filter((chip) => !(chip.id === s.id && chip.type === s.type)));
              }}
            >
              <span className="inline-flex items-center gap-1">
                <ChipIcon className="h-3 w-3 shrink-0" />
                <span className="truncate">{chipLabel(s)}</span>
              </span>
            </CampaignChip>
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
          className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          aria-label={mode === "exclude" ? "Search audiences to exclude" : "Search audiences"}
        />
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </CampaignAudienceField>
      {open && (
        <CampaignDropdownPanel>
          {grouped.some(([, rows]) => rows.some((r) => r.group === "suggested")) ? (
            <div className="mb-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
              <p className="text-[11px] text-muted-foreground">
                Booking-based audiences use appointment history on canonical contacts.
              </p>
              <label className="mt-2 block text-[11px] font-medium text-foreground">
                Booking type name (for “Customers of a booking type” preset)
                <input
                  value={bookingTypeName}
                  onChange={(e) => setBookingTypeName(e.target.value)}
                  placeholder="e.g. Deep tissue massage"
                  className="mt-1 block w-full rounded-md border border-border bg-card px-2 py-1 text-[12px]"
                />
              </label>
            </div>
          ) : null}
          {loading && grouped.length === 0 ? (
            <div className="flex items-center gap-2 px-2 py-3 text-[13px] text-muted-foreground">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
              Loading audiences…
            </div>
          ) : grouped.length === 0 ? (
            <p className="px-2 py-3 text-[13px] text-muted-foreground">
              No audiences found. Try another name or phone number.
            </p>
          ) : (
            grouped.map(([group, rows]) => (
              <div key={group}>
                <p className="mb-1 mt-2 px-2 text-[10px] font-bold uppercase tracking-[0.07em] text-muted-foreground first:mt-0">
                  {groupLabel(group)}
                </p>
                {rows.map((item) => (
                  <Row key={`${item.type}-${item.id}`} item={item} />
                ))}
              </div>
            ))
          )}
          <div className="mt-2 border-t border-border pt-2">
            <Link
              href="/contacts/imports"
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              Import contacts
            </Link>
          </div>
        </CampaignDropdownPanel>
      )}
    </div>
  );
}
