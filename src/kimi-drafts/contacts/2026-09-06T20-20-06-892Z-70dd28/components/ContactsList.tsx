"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  Search,
  SlidersHorizontal,
  ChevronDown,
  UserPlus,
  Upload,
  Check,
  CheckCircle2,
  Trash2,
  Copy,
  MoreHorizontal,
  Download,
  UserMinus,
  ListPlus,
  Loader2,
  Inbox,
  X,
  AlertTriangle,
  RefreshCw,
  CalendarClock,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import {
  contacts as seedContacts,
  stats as seedStats,
  contactAppointments,
  type Contact,
  type OptInStatus,
} from "../mock-data";
import { ConfirmDeleteModal } from "./Modal";

const STATUS_FILTERS: Array<{ value: OptInStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "Subscribed", label: "Subscribed" },
  { value: "Unsubscribed", label: "Unsubscribed" },
  { value: "Blocked", label: "Blocked" },
  { value: "Not Subscribed", label: "Not subscribed" },
];

const PAGE_SIZE = 15;

function formatPhone(mobile: string) {
  const digits = mobile.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1"))
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return mobile;
}

function downloadCsv(rows: Contact[]) {
  const header = "First Name,Last Name,Mobile,Email,Status,Created";
  const body = rows
    .map((c) =>
      [c.firstName, c.lastName, c.mobile, c.email, c.status, c.created]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "contacts.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-semibold tabular-nums leading-tight tracking-tight text-foreground">
          {value}
        </p>
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
        : status === "Blocked"
          ? "border-slate-300 bg-slate-100 text-slate-600"
          : "border-border bg-muted/60 text-muted-foreground";
  const dot =
    status === "Subscribed"
      ? "bg-emerald-500"
      : status === "Unsubscribed"
        ? "bg-rose-500"
        : status === "Blocked"
          ? "bg-slate-500"
          : "bg-muted-foreground/60";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}

function displayMobile(mobile: string) {
  if (!mobile) return "—";
  return formatPhone(mobile);
}

function contactName(c: Contact) {
  const name = `${c.firstName} ${c.lastName}`.trim();
  return name || displayMobile(c.mobile) || "Unknown";
}

function initials(c: Contact) {
  const a = (c.firstName || "").trim()[0] || "";
  const b = (c.lastName || "").trim()[0] || "";
  return (a + b).toUpperCase() || "—";
}

const AVATAR_TINTS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

function avatarTint(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

const menuItemCls =
  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted";
const menuCls =
  "absolute z-30 min-w-[200px] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12),0_2px_6px_rgba(16,24,40,0.06)] animate-in fade-in zoom-in-95 duration-100";
const checkCls = "kc-check h-4 w-4 rounded border-border";

function SkeletonRows({ rows = 8 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-4 py-3.5">
            <div className="h-4 w-4 rounded bg-muted" />
          </td>
          <td className="px-3 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="h-3.5 w-32 rounded bg-muted" />
            </div>
          </td>
          <td className="px-3 py-3.5">
            <div className="h-3.5 w-24 rounded bg-muted" />
          </td>
          <td className="px-3 py-3.5">
            <div className="h-3.5 w-36 rounded bg-muted" />
          </td>
          <td className="px-3 py-3.5">
            <div className="h-5 w-20 rounded-full bg-muted" />
          </td>
          <td className="px-3 py-3.5">
            <div className="h-3.5 w-28 rounded bg-muted" />
          </td>
          <td className="px-3 py-3.5" />
        </tr>
      ))}
    </>
  );
}

export default function ContactsList({
  contacts = seedContacts,
  stats = seedStats,
  listOptions = [],
  loading = false,
  serverFiltered = false,
  error = "",
  degraded = "",
  readOnly = false,
  onRetry,
  onFiltersChange,
  onCreateOne,
  onImportList,
  onDeleteContacts,
  onAddToLists,
  onRemoveFromLists,
  onUnsubscribeContacts,
  savedToast,
}: {
  contacts?: Contact[];
  stats?: typeof seedStats;
  listOptions?: Array<{ id: string; name: string }>;
  loading?: boolean;
  serverFiltered?: boolean;
  error?: string;
  degraded?: string;
  readOnly?: boolean;
  onRetry?: () => void;
  onFiltersChange?: (query: string, status: OptInStatus | "all") => void;
  onCreateOne: () => void;
  onImportList: () => void;
  onDeleteContacts?: (ids: string[]) => Promise<void>;
  onAddToLists?: (contactIds: string[], listIds: string[]) => void | Promise<void>;
  onRemoveFromLists?: (contactIds: string[], listIds: string[]) => void | Promise<void>;
  onUnsubscribeContacts?: (contactIds: string[]) => void | Promise<void>;
  savedToast: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [rowMenuFor, setRowMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OptInStatus | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickedLists, setPickedLists] = useState<Set<string>>(new Set());
  const [removeLists, setRemoveLists] = useState<Set<string>>(new Set());
  const [listSearch, setListSearch] = useState("");
  const [removeListSearch, setRemoveListSearch] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<null | { ids: string[]; label: string }>(null);
  const [viewContact, setViewContact] = useState<Contact | null>(null);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Close popovers on outside click.
  useEffect(() => {
    if (!menuOpen && !filterOpen && !rowMenuFor && !actionsOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false);
      if (filterOpen && filterRef.current && !filterRef.current.contains(target)) setFilterOpen(false);
      if (actionsOpen && !(e.target as HTMLElement).closest?.("[data-bulk-actions]")) setActionsOpen(false);
      if (rowMenuFor && rowMenuRef.current && !rowMenuRef.current.contains(target)) setRowMenuFor(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, filterOpen, rowMenuFor, actionsOpen]);

  // Notify parent of filter changes (server-side filtering wiring).
  const filtersReadyRef = useRef(false);
  useEffect(() => {
    if (!onFiltersChange) return;
    if (!filtersReadyRef.current) {
      filtersReadyRef.current = true;
      return;
    }
    onFiltersChange(query, statusFilter);
  }, [query, statusFilter, onFiltersChange]);

  // Reset visible window when filters change.
  useEffect(() => {
    setShownCount(PAGE_SIZE);
  }, [query, statusFilter]);

  const filtered = useMemo(() => {
    if (serverFiltered) return contacts;
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        contactName(c).toLowerCase().includes(q) ||
        c.mobile.replace(/\D/g, "").includes(q.replace(/\D/g, "") || " ") ||
        c.email.toLowerCase().includes(q)
      );
    });
  }, [contacts, query, statusFilter, serverFiltered]);

  const visible = useMemo(() => filtered.slice(0, shownCount), [filtered, shownCount]);
  const hasMore = filtered.length > shownCount;

  const allChecked = visible.length > 0 && visible.every((c) => selectedIds.has(c.id));
  const someChecked = visible.some((c) => selectedIds.has(c.id));

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) visible.forEach((c) => next.delete(c.id));
      else visible.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const runBulkAction = async (fn: () => void | Promise<void>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setActionMessage(done);
      setTimeout(() => setActionMessage(""), 3000);
      clearSelection();
      setAddOpen(false);
      setRemoveOpen(false);
      setPickedLists(new Set());
      setRemoveLists(new Set());
    } finally {
      setBusy(false);
    }
  };

  const handleCopyPhones = async (ids?: string[]) => {
    const idSet = ids ? new Set(ids) : selectedIds;
    const phones = contacts.filter((c) => idSet.has(c.id)).map((c) => displayMobile(c.mobile));
    try {
      await navigator.clipboard.writeText(phones.join("\n"));
      setActionMessage(ids ? "Phone number copied" : "Phone numbers copied");
      setTimeout(() => setActionMessage(""), 3000);
    } catch {
      /* clipboard unavailable in sandbox */
    }
  };

  // Destructive deletes flow through a confirmation modal.
  const executeDelete = async () => {
    if (!confirmDelete || !onDeleteContacts) return;
    setDeleting(true);
    try {
      await onDeleteContacts(confirmDelete.ids);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        confirmDelete.ids.forEach((id) => next.delete(id));
        return next;
      });
      setActionMessage(
        confirmDelete.ids.length === 1 ? "Contact deleted" : `${confirmDelete.ids.length} contacts deleted`,
      );
      setTimeout(() => setActionMessage(""), 3000);
      if (viewContact && confirmDelete.ids.includes(viewContact.id)) setViewContact(null);
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const togglePick = (id: string) =>
    setPickedLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleRemovePick = (id: string) =>
    setRemoveLists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filteredAddLists = listOptions.filter((l) => l.name.toLowerCase().includes(listSearch.toLowerCase()));
  const filteredRemoveLists = listOptions.filter((l) => l.name.toLowerCase().includes(removeListSearch.toLowerCase()));

  const activeFilterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "All statuses";
  const isFiltered = query.trim() !== "" || statusFilter !== "all";
  const showSkeleton = loading && visible.length === 0 && !error;
  const contactHistory = viewContact ? (contactAppointments[viewContact.id] ?? null) : null;

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-16 pt-7 lg:px-8">
      {/* Page header */}
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Contacts</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            View and manage the people tied to your appointments and messages.
          </p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 text-[13px] font-semibold text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-muted"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                Actions
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen && (
                <div className={`${menuCls} right-0 top-10`} role="menu">
                  <button type="button" className={menuItemCls} onClick={() => { setMenuOpen(false); onCreateOne(); }}>
                    <UserPlus className="h-4 w-4 text-muted-foreground" />
                    Create one contact
                  </button>
                  <button type="button" className={menuItemCls} onClick={() => { setMenuOpen(false); onImportList(); }}>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    Import a list
                  </button>
                  <button
                    type="button"
                    className={menuItemCls}
                    onClick={() => {
                      downloadCsv(filtered);
                      setMenuOpen(false);
                    }}
                  >
                    <Download className="h-4 w-4 text-muted-foreground" />
                    Export contacts
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onCreateOne}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              Add contact
            </button>
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="mb-5 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Contacts" value={stats.contacts.toLocaleString()} tint="bg-indigo-50 text-indigo-600" />
        <StatCard icon={UserCheck} label="Subscribed" value={stats.subscribed.toLocaleString()} tint="bg-emerald-50 text-emerald-600" />
        <StatCard icon={UserX} label="Unsubscribed" value={stats.unsubscribed.toLocaleString()} tint="bg-rose-50 text-rose-600" />
      </div>

      {/* Partial / degraded notice */}
      {degraded && (
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] font-medium text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="flex-1">{degraded}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 font-semibold text-amber-900 transition-colors hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
        </div>
      )}

      {/* Control bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone, or email"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] text-foreground shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30"
            aria-label="Search contacts"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors ${
              statusFilter !== "all"
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted"
            }`}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterLabel}
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${filterOpen ? "rotate-180" : ""}`} />
          </button>
          {filterOpen && (
            <div className={`${menuCls} left-0 top-10 min-w-[180px]`} role="listbox">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`${menuItemCls} justify-between`}
                  onClick={() => {
                    setStatusFilter(f.value);
                    setFilterOpen(false);
                  }}
                  role="option"
                  aria-selected={statusFilter === f.value}
                >
                  {f.label}
                  {statusFilter === f.value && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {loading && visible.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Updating…
          </span>
        )}
        {actionMessage && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {actionMessage}
          </span>
        )}
        {readOnly && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            Read-only access
          </span>
        )}
      </div>

      {/* Bulk action bar */}
      {!readOnly && selectedIds.size > 0 && (
        <div
          data-bulk-actions
          className="animate-in fade-in mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5"
        >
          <span className="text-[13px] font-semibold text-foreground">
            {selectedIds.size} selected
          </span>
          <button onClick={clearSelection} className="text-[13px] font-medium text-primary transition-colors hover:underline">
            Clear
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setActionsOpen((v) => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              Bulk actions
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
            </button>
            {actionsOpen && (
              <div className={`${menuCls} left-0 top-9`}>
                <button
                  type="button"
                  className={menuItemCls}
                  onClick={() => {
                    setAddOpen(true);
                    setActionsOpen(false);
                    setPickedLists(new Set());
                    setListSearch("");
                  }}
                >
                  <ListPlus className="h-4 w-4 text-muted-foreground" />
                  Add to lists
                </button>
                <button
                  type="button"
                  className={menuItemCls}
                  onClick={() => {
                    setRemoveOpen(true);
                    setActionsOpen(false);
                    setRemoveLists(new Set());
                    setRemoveListSearch("");
                  }}
                >
                  <UserMinus className="h-4 w-4 text-muted-foreground" />
                  Remove from lists
                </button>
                <button
                  type="button"
                  className={menuItemCls}
                  onClick={() => {
                    void handleCopyPhones();
                    setActionsOpen(false);
                  }}
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  Copy phone numbers
                </button>
                <button
                  type="button"
                  className={menuItemCls}
                  onClick={() =>
                    void runBulkAction(async () => {
                      await onUnsubscribeContacts?.([...selectedIds]);
                    }, "Contacts unsubscribed")
                  }
                >
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  Unsubscribe
                </button>
                <button
                  type="button"
                  className={menuItemCls}
                  onClick={() => {
                    downloadCsv(contacts.filter((c) => selectedIds.has(c.id)));
                    setActionsOpen(false);
                  }}
                >
                  <Download className="h-4 w-4 text-muted-foreground" />
                  Export selected
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setConfirmDelete({
                ids: [...selectedIds],
                label: `${selectedIds.size} selected contact${selectedIds.size === 1 ? "" : "s"}`,
              })
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-card px-2.5 text-[12px] font-semibold text-rose-600 transition-colors hover:bg-rose-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left" aria-label="Contacts">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th scope="col" className="w-10 px-4 py-3">
                  {!readOnly && (
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      className={checkCls}
                      checked={allChecked}
                      onChange={toggleAll}
                      aria-label="Select all contacts"
                    />
                  )}
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Name
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mobile
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Email
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Opt-in status
                </th>
                <th scope="col" className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Created
                </th>
                <th scope="col" className="w-12 px-3 py-3" aria-label="Row actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {showSkeleton ? (
                <SkeletonRows />
              ) : (
                visible.map((c) => (
                  <tr key={c.id} className="group transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      {!readOnly && (
                        <input
                          type="checkbox"
                          className={checkCls}
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleOne(c.id)}
                          aria-label={`Select ${contactName(c)}`}
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setViewContact(c)}
                        className="flex items-center gap-2.5 rounded-md text-left transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${avatarTint(c.id)}`}
                          aria-hidden="true"
                        >
                          {initials(c)}
                        </span>
                        <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">
                          {contactName(c)}
                        </span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] tabular-nums text-muted-foreground">
                      {displayMobile(c.mobile)}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-3 text-[13px] text-muted-foreground">
                      {c.email || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[12px] text-muted-foreground">{c.created}</td>
                    <td className="relative px-3 py-3">
                      <button
                        type="button"
                        onClick={() => setRowMenuFor(rowMenuFor === c.id ? null : c.id)}
                        className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                        aria-label={`More actions for ${contactName(c)}`}
                        aria-haspopup="menu"
                        aria-expanded={rowMenuFor === c.id}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {rowMenuFor === c.id && (
                        <div ref={rowMenuRef} className={`${menuCls} right-3 top-10 min-w-[180px]`} role="menu">
                          <button
                            type="button"
                            className={menuItemCls}
                            onClick={() => {
                              setRowMenuFor(null);
                              setViewContact(c);
                            }}
                          >
                            <Users className="h-4 w-4 text-muted-foreground" />
                            View contact
                          </button>
                          <button
                            type="button"
                            className={menuItemCls}
                            onClick={() => {
                              setRowMenuFor(null);
                              void handleCopyPhones([c.id]);
                            }}
                          >
                            <Copy className="h-4 w-4 text-muted-foreground" />
                            Copy phone number
                          </button>
                          {!readOnly && (
                            <>
                              <button
                                type="button"
                                className={menuItemCls}
                                onClick={() => {
                                  setRowMenuFor(null);
                                  void runBulkAction(async () => {
                                    await onUnsubscribeContacts?.([c.id]);
                                  }, "Contact unsubscribed");
                                }}
                              >
                                <UserMinus className="h-4 w-4 text-muted-foreground" />
                                Unsubscribe
                              </button>
                              <div className="my-1 h-px bg-border" />
                              <button
                                type="button"
                                className={`${menuItemCls} text-rose-600 hover:bg-rose-50`}
                                onClick={() => {
                                  setRowMenuFor(null);
                                  setConfirmDelete({ ids: [c.id], label: contactName(c) });
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete contact
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Error state — page structure preserved, retry offered */}
        {error && !showSkeleton && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
            </span>
            <h3 className="text-[15px] font-semibold text-foreground">Contacts couldn&rsquo;t be loaded</h3>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">{error}</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            )}
          </div>
        )}

        {/* Empty / no-results states */}
        {!error && !showSkeleton && visible.length === 0 && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {isFiltered ? <Search className="h-5 w-5 text-muted-foreground" /> : <Inbox className="h-5 w-5 text-muted-foreground" />}
            </span>
            {isFiltered ? (
              <>
                <h3 className="text-[15px] font-semibold text-foreground">No contacts match your filters</h3>
                <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
                  Try a different search term or clear the status filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                  }}
                  className="mt-4 h-9 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <h3 className="text-[15px] font-semibold text-foreground">No contacts yet</h3>
                <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
                  Contacts appear here when customers book appointments or you add them manually.
                </p>
                {!readOnly && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onCreateOne}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <UserPlus className="h-4 w-4" />
                      Add contact
                    </button>
                    <button
                      type="button"
                      onClick={onImportList}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <Upload className="h-4 w-4" />
                      Import a list
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Footer count + load more */}
        {!error && visible.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
            <p className="text-[12px] text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{visible.length.toLocaleString()}</span>{" "}
              {isFiltered ? `of ${filtered.length.toLocaleString()} matching` : "of"} {stats.contacts.toLocaleString()} contacts
            </p>
            <div className="flex items-center gap-3">
              {savedToast && (
                <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Saved
                </span>
              )}
              {hasMore && (
                <button
                  type="button"
                  onClick={() => setShownCount((n) => n + PAGE_SIZE)}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  Load more
                  <ChevronDown className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contact quick-view drawer */}
      {viewContact && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/45 backdrop-blur-[2px] animate-in fade-in"
          onClick={() => setViewContact(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Contact: ${contactName(viewContact)}`}
        >
          <div
            className="kc-scroll h-full w-full max-w-md overflow-y-auto border-l border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-6 py-5">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-semibold ${avatarTint(viewContact.id)}`}
                  aria-hidden="true"
                >
                  {initials(viewContact)}
                </span>
                <div>
                  <h2 className="font-display text-[17px] font-semibold tracking-tight text-foreground">
                    {contactName(viewContact)}
                  </h2>
                  <div className="mt-1">
                    <StatusPill status={viewContact.status} />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewContact(null)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {/* Core info */}
              <dl className="space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[12px] font-medium text-muted-foreground">Mobile</dt>
                  <dd className="text-[13px] tabular-nums text-foreground">{displayMobile(viewContact.mobile)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[12px] font-medium text-muted-foreground">Email</dt>
                  <dd className="truncate text-[13px] text-foreground">{viewContact.email || "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-[12px] font-medium text-muted-foreground">Created</dt>
                  <dd className="text-[13px] text-foreground">{viewContact.created}</dd>
                </div>
              </dl>

              {/* Consent */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Messaging consent
                </h3>
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-[12px] leading-relaxed text-muted-foreground">
                  {viewContact.status === "Subscribed"
                    ? "This contact has agreed to receive appointment reminders and messages."
                    : viewContact.status === "Unsubscribed"
                      ? "This contact has opted out. No messages will be sent unless they re-subscribe."
                      : viewContact.status === "Blocked"
                        ? "Messaging to this contact is blocked."
                        : "No messaging permission on file. Messages won't be sent until they subscribe."}
                </div>
              </section>

              {/* Appointments */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5" />
                  Appointments
                </h3>
                {contactHistory ? (
                  <div className="space-y-2">
                    {contactHistory.upcoming && (
                      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5">
                        <p className="text-[13px] font-semibold text-foreground">{contactHistory.upcoming.title}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {contactHistory.upcoming.when} · {contactHistory.upcoming.status}
                        </p>
                      </div>
                    )}
                    {contactHistory.history.map((h) => (
                      <div key={h.title + h.when} className="rounded-xl border border-border bg-card p-3.5">
                        <p className="text-[13px] font-medium text-foreground">{h.title}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">
                          {h.when} · {h.status}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-[12px] text-muted-foreground">
                    No appointments on record for this contact.
                  </div>
                )}
              </section>

              {/* Conversations */}
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Conversations
                </h3>
                <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-[12px] text-muted-foreground">
                  {viewContact.status === "Subscribed"
                    ? "Open Messages to view this contact's conversation history."
                    : "No active conversation. This contact isn't reachable by message."}
                </div>
              </section>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-6 py-4">
              <a
                href={`/contacts/${encodeURIComponent(viewContact.id)}`}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open full profile
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete({ ids: [viewContact.id], label: contactName(viewContact) })}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-card px-3.5 text-[13px] font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add-to-lists popover */}
      {addOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] animate-in fade-in" onClick={() => setAddOpen(false)} role="dialog" aria-modal="true" aria-label="Add contacts to lists">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-foreground">Add to lists</h2>
            <p className="mb-3 mt-1 text-[12px] text-muted-foreground">
              Add {selectedIds.size} selected contact{selectedIds.size === 1 ? "" : "s"} to one or more lists.
            </p>
            <input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search lists"
              className="mb-2 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <div className="kc-scroll max-h-56 overflow-y-auto rounded-lg border border-border">
              {filteredAddLists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => togglePick(l.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <input type="checkbox" className={checkCls} checked={pickedLists.has(l.id)} readOnly tabIndex={-1} />
                  {l.name}
                </button>
              ))}
              {filteredAddLists.length === 0 && (
                <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">No lists match.</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="h-9 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pickedLists.size === 0 || busy}
                onClick={() =>
                  void runBulkAction(async () => {
                    await onAddToLists?.([...selectedIds], [...pickedLists]);
                  }, `Added to ${pickedLists.size} list${pickedLists.size === 1 ? "" : "s"}`)
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add to lists
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove-from-lists popover */}
      {removeOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] animate-in fade-in" onClick={() => setRemoveOpen(false)} role="dialog" aria-modal="true" aria-label="Remove contacts from lists">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-[15px] font-semibold tracking-tight text-foreground">Remove from lists</h2>
            <p className="mb-3 mt-1 text-[12px] text-muted-foreground">
              Remove {selectedIds.size} selected contact{selectedIds.size === 1 ? "" : "s"} from the chosen lists.
            </p>
            <input
              value={removeListSearch}
              onChange={(e) => setRemoveListSearch(e.target.value)}
              placeholder="Search lists"
              className="mb-2 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <div className="kc-scroll max-h-56 overflow-y-auto rounded-lg border border-border">
              {filteredRemoveLists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleRemovePick(l.id)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  <input type="checkbox" className={checkCls} checked={removeLists.has(l.id)} readOnly tabIndex={-1} />
                  {l.name}
                </button>
              ))}
              {filteredRemoveLists.length === 0 && (
                <p className="px-3 py-4 text-center text-[12px] text-muted-foreground">No lists match.</p>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemoveOpen(false)}
                className="h-9 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeLists.size === 0 || busy}
                onClick={() =>
                  void runBulkAction(async () => {
                    await onRemoveFromLists?.([...selectedIds], [...removeLists]);
                  }, `Removed from ${removeLists.size} list${removeLists.size === 1 ? "" : "s"}`)
                }
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmDeleteModal
          label={confirmDelete.label}
          count={confirmDelete.ids.length}
          busy={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => void executeDelete()}
        />
      )}
    </div>
  );
}
