"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  SlidersHorizontal,
  ChevronDown,
  UserPlus,
  Upload,
  ArrowUpDown,
  Info,
  CheckCircle2,
  Trash2,
  Copy,
  Pencil,
  MoreHorizontal,
  X,
} from "lucide-react";
import { contacts as seedContacts, stats as seedStats, type Contact, type OptInStatus } from "../mock-data";
import { formatPhone } from "@/lib/utils";

const STATUS_FILTERS: Array<{ value: OptInStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "Subscribed", label: "Subscribed" },
  { value: "Unsubscribed", label: "Unsubscribed" },
  { value: "Blocked", label: "Blocked" },
  { value: "Not Subscribed", label: "Not subscribed" },
];

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-muted-foreground">
          {label} <Info className="h-3 w-3 opacity-50" />
        </span>
        <span className="font-display text-[22px] font-semibold tracking-tight text-foreground">{value}</span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Subscribed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Unsubscribed"
        ? "border-rose-200 bg-rose-50 text-rose-600"
        : "border-border bg-muted/60 text-muted-foreground";
  const dot =
    status === "Subscribed" ? "bg-emerald-500" : status === "Unsubscribed" ? "bg-rose-500" : "bg-muted-foreground/60";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function displayMobile(mobile: string) {
  if (!mobile) return "—";
  return formatPhone(mobile);
}

export default function ContactsList({
  contacts = seedContacts,
  stats = seedStats,
  onCreateOne,
  onImportList,
  onDeleteContacts,
  savedToast,
}: {
  contacts?: Contact[];
  stats?: typeof seedStats;
  onCreateOne: () => void;
  onImportList: () => void;
  onDeleteContacts?: (ids: string[]) => Promise<void>;
  savedToast: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OptInStatus | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen && !filterOpen && !rowMenuFor) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (filterOpen && filterRef.current && !filterRef.current.contains(target)) setFilterOpen(false);
      if (rowMenuFor && rowMenuRef.current && !rowMenuRef.current.contains(target)) setRowMenuFor(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, filterOpen, rowMenuFor]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${c.firstName} ${c.lastName} ${c.mobile} ${displayMobile(c.mobile)} ${c.email}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [contacts, query, statusFilter]);

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));
  const someVisibleSelected = filtered.some((c) => selectedIds.has(c.id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [someVisibleSelected, allVisibleSelected]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDeleteSelected = async () => {
    if (!onDeleteContacts || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} contact${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDeleteContacts([...selectedIds]);
      clearSelection();
      setActionMessage(`Deleted ${count} contact${count === 1 ? "" : "s"}.`);
      window.setTimeout(() => setActionMessage(""), 3000);
    } catch {
      setActionMessage("Could not delete selected contacts.");
      window.setTimeout(() => setActionMessage(""), 4000);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOne = async (contact: Contact) => {
    if (!onDeleteContacts) return;
    if (!window.confirm(`Delete ${contact.firstName || contact.mobile || "this contact"}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDeleteContacts([contact.id]);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(contact.id);
        return next;
      });
      setActionMessage("Contact deleted.");
      window.setTimeout(() => setActionMessage(""), 3000);
    } catch {
      setActionMessage("Could not delete contact.");
      window.setTimeout(() => setActionMessage(""), 4000);
    } finally {
      setDeleting(false);
      setRowMenuFor(null);
    }
  };

  const handleCopyPhones = async () => {
    const phones = contacts
      .filter((c) => selectedIds.has(c.id) && c.mobile)
      .map((c) => c.mobile)
      .join("\n");
    if (!phones) return;
    try {
      await navigator.clipboard.writeText(phones);
      setActionMessage(`Copied ${selectedIds.size} phone number${selectedIds.size === 1 ? "" : "s"}.`);
      window.setTimeout(() => setActionMessage(""), 3000);
    } catch {
      setActionMessage("Could not copy to clipboard.");
      window.setTimeout(() => setActionMessage(""), 4000);
    }
  };

  const activeFilterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "Filter";

  return (
    <div className="px-8 pb-10 pt-6">
      {(savedToast || actionMessage) && (
        <div className="fixed right-6 top-5 z-40 flex items-center gap-2.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-emerald-600/25 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4" />
          {actionMessage || "Contact saved."}
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-4 w-4" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Contacts</h1>
      </div>
      <p className="mb-6 mt-1 text-[13px] text-muted-foreground">View and manage all of your contacts.</p>

      <div className="mb-7 flex items-center gap-16">
        <StatCard icon={Users} label="Contacts" value={stats.contacts.toLocaleString()} tint="bg-indigo-50 text-indigo-600" />
        <StatCard icon={UserCheck} label="Subscribed Contacts" value={stats.subscribed.toLocaleString()} tint="bg-emerald-50 text-emerald-600" />
        <StatCard icon={UserX} label="Unsubscribed Contacts" value={String(stats.unsubscribed)} tint="bg-rose-50 text-rose-500" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen(!filterOpen)}
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium shadow-sm transition-colors ${
                statusFilter !== "all"
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted/60"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
              {statusFilter === "all" ? "Filter" : activeFilterLabel}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <div className="absolute left-0 top-full z-30 mt-1.5 w-52 rounded-lg border border-border bg-card py-1.5 shadow-lg">
                {STATUS_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setStatusFilter(option.value);
                      setFilterOpen(false);
                    }}
                    className={`flex w-full px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-muted ${
                      statusFilter === option.value ? "font-semibold text-primary" : "text-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-64 items-center gap-2 rounded-lg border border-border bg-card px-3 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/30">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts…"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-primary pl-4 pr-3 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
              >
                Create Contact <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-20 mt-1.5 w-48 rounded-lg border border-border bg-card py-1.5 shadow-lg animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onCreateOne(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground transition-colors hover:bg-muted"
                  >
                    <UserPlus className="h-4 w-4 text-muted-foreground" /> Create One
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onImportList(); }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] text-foreground transition-colors hover:bg-muted"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" /> Import List
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
            <span className="text-[13px] font-medium text-foreground">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              onClick={() => void handleCopyPhones()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Copy className="h-3.5 w-3.5" /> Copy numbers
            </button>
            {onDeleteContacts ? (
              <button
                type="button"
                onClick={() => void handleDeleteSelected()}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="w-10 py-2.5 pl-4 pr-2">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    className="kc-check"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all contacts on this page"
                  />
                </th>
                {["First Name", "Last Name", "Mobile Number", "Email", "Opt-In Status", "Created"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[12px] font-semibold text-muted-foreground">
                    <span className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
                      {h} <ArrowUpDown className="h-3 w-3 opacity-50" />
                    </span>
                  </th>
                ))}
                <th className="w-12 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const selected = selectedIds.has(c.id);
                return (
                  <tr
                    key={c.id}
                    className={`border-b border-border transition-colors last:border-0 ${
                      selected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                    }`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <input
                        type="checkbox"
                        className="kc-check"
                        checked={selected}
                        onChange={() => toggleRow(c.id)}
                        aria-label={`Select ${c.firstName} ${c.lastName}`.trim()}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/contacts/${c.id}`} className="text-primary hover:underline">
                        {c.firstName || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      <Link href={`/contacts/${c.id}`} className="hover:text-primary hover:underline">
                        {c.lastName || "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-primary">{displayMobile(c.mobile)}</td>
                    <td className="px-4 py-3 text-foreground">{c.email || <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{c.created}</td>
                    <td className="relative px-4 py-3" ref={rowMenuFor === c.id ? rowMenuRef : undefined}>
                      <button
                        type="button"
                        onClick={() => setRowMenuFor(rowMenuFor === c.id ? null : c.id)}
                        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Contact actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {rowMenuFor === c.id && (
                        <div className="absolute right-4 top-10 z-30 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                          <Link
                            href={`/contacts/${c.id}`}
                            className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-muted"
                            onClick={() => setRowMenuFor(null)}
                          >
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground" /> View / edit
                          </Link>
                          {onDeleteContacts ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteOne(c)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] text-rose-600 transition-colors hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          ) : null}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-14 text-center">
                    <div className="mx-auto flex max-w-xs flex-col items-center">
                      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        <Search className="h-4 w-4" />
                      </span>
                      <p className="text-[13px] font-medium text-foreground">No contacts found</p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {query || statusFilter !== "all"
                          ? "Try a different search or filter."
                          : "Create or import contacts to get started."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
