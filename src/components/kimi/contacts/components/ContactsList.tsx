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
} from "lucide-react";
import { contacts as seedContacts, stats as seedStats, type Contact, type OptInStatus } from "../mock-data";
import { formatPhone } from "@/lib/utils";
import { downloadContactsCsv } from "@/lib/contacts/download-csv";

const STATUS_FILTERS: Array<{ value: OptInStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "Subscribed", label: "Subscribed" },
  { value: "Unsubscribed", label: "Unsubscribed" },
  { value: "Blocked", label: "Blocked" },
  { value: "Not Subscribed", label: "Not subscribed" },
];

function StatCard({ icon: Icon, label, value, tint }: { icon: typeof Users; label: string; value: string; tint: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-lg font-semibold tabular-nums leading-tight tracking-tight text-foreground">{value}</p>
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
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${tone}`}>
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

const menuItemCls =
  "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted";
const menuCls =
  "absolute z-30 min-w-[200px] overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-[0_8px_24px_rgba(16,24,40,0.12),0_2px_6px_rgba(16,24,40,0.06)] animate-in fade-in zoom-in-95 duration-100";

const checkCls = "kc-check h-4 w-4 rounded border-border accent-primary";

export default function ContactsList({
  contacts = seedContacts,
  stats = seedStats,
  listOptions = [],
  loading = false,
  serverFiltered = false,
  onFiltersChange,
  onCreateOne,
  onImportList,
  onDeleteContacts,
  onAddToLists,
  onRemoveFromLists,
  onUnsubscribeContacts,
  onMergeContact,
  savedToast,
}: {
  contacts?: Contact[];
  stats?: typeof seedStats;
  listOptions?: Array<{ id: string; name: string }>;
  loading?: boolean;
  serverFiltered?: boolean;
  onFiltersChange?: (query: string, status: OptInStatus | "all") => void;
  onCreateOne: () => void;
  onImportList: () => void;
  onDeleteContacts?: (ids: string[]) => Promise<void>;
  onAddToLists?: (contactIds: string[], listIds: string[]) => void | Promise<void>;
  onRemoveFromLists?: (contactIds: string[], listIds: string[]) => void | Promise<void>;
  onUnsubscribeContacts?: (contactIds: string[]) => void | Promise<void>;
  onMergeContact?: (contact: Contact) => void;
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
  const menuRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const filtersReadyRef = useRef(false);

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

  useEffect(() => {
    if (!filtersReadyRef.current) {
      filtersReadyRef.current = true;
      return;
    }
    onFiltersChange?.(query, statusFilter);
  }, [query, statusFilter, onFiltersChange]);

  const filtered = useMemo(() => {
    if (serverFiltered) return contacts;
    const q = query.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${c.firstName} ${c.lastName} ${c.mobile} ${displayMobile(c.mobile)} ${c.email}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [contacts, query, statusFilter, serverFiltered]);

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
      if (allVisibleSelected) filtered.forEach((c) => next.delete(c.id));
      else filtered.forEach((c) => next.add(c.id));
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

  const showActionMessage = (msg: string, isError = false) => {
    setActionMessage(msg);
    window.setTimeout(() => setActionMessage(""), isError ? 4000 : 3000);
  };

  const handleDeleteSelected = async () => {
    if (!onDeleteContacts || selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} contact${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDeleteContacts([...selectedIds]);
      clearSelection();
      showActionMessage(`Deleted ${count} contact${count === 1 ? "" : "s"}.`);
    } catch {
      showActionMessage("Could not delete selected contacts.", true);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteOne = async (contact: Contact) => {
    if (!onDeleteContacts) return;
    if (!window.confirm(`Delete ${contactName(contact)}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await onDeleteContacts([contact.id]);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(contact.id);
        return next;
      });
      showActionMessage("Contact deleted.");
    } catch {
      showActionMessage("Could not delete contact.", true);
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
      showActionMessage(`Copied ${selectedIds.size} phone number${selectedIds.size === 1 ? "" : "s"}.`);
    } catch {
      showActionMessage("Could not copy to clipboard.", true);
    }
  };

  const activeFilterLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label ?? "Filter";
  const filteredLists = listOptions.filter((l) => l.name.toLowerCase().includes(listSearch.toLowerCase()));
  const filteredRemoveLists = listOptions.filter((l) => l.name.toLowerCase().includes(removeListSearch.toLowerCase()));

  const togglePick = (id: string) => {
    const s = new Set(pickedLists);
    if (s.has(id)) s.delete(id); else s.add(id);
    setPickedLists(s);
  };
  const toggleRemovePick = (id: string) => {
    const s = new Set(removeLists);
    if (s.has(id)) s.delete(id); else s.add(id);
    setRemoveLists(s);
  };

  const runBulkAction = async (action: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionsOpen(false);
    try {
      await action();
      clearSelection();
    } finally {
      setBusy(false);
    }
  };

  const hasSelection = selectedIds.size > 0;
  const isFiltering = query.trim() !== "" || statusFilter !== "all";

  return (
    <div className="mx-auto max-w-[1200px] px-6 pb-12 pt-7 lg:px-8">
      {(savedToast || actionMessage) && (
        <div className="fixed right-6 top-5 z-40 flex items-center gap-2.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg shadow-emerald-600/25 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="h-4 w-4" />
          {actionMessage || "Contact saved."}
        </div>
      )}

      {/* Page header */}
      <div className="mb-1 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-4 w-4" />
        </span>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">Contacts</h1>
      </div>
      <p className="mb-6 text-[13px] text-muted-foreground">View and manage all of your contacts.</p>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Contacts" value={stats.contacts.toLocaleString()} tint="bg-indigo-50 text-indigo-600" />
        <StatCard icon={UserCheck} label="Subscribed" value={stats.subscribed.toLocaleString()} tint="bg-emerald-50 text-emerald-600" />
        <StatCard icon={UserX} label="Unsubscribed" value={stats.unsubscribed.toLocaleString()} tint="bg-rose-50 text-rose-500" />
      </div>

      {stats.contacts > contacts.length && contacts.length > 0 && (
        <p className="mb-4 text-xs text-muted-foreground">
          Showing the most recent {contacts.length.toLocaleString()} of {stats.contacts.toLocaleString()} contacts. Use search to find a specific contact.
        </p>
      )}

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        {/* Filter dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold shadow-sm transition-colors ${
              statusFilter !== "all"
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-card text-foreground hover:bg-muted/60"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {statusFilter === "all" ? "Filter" : activeFilterLabel}
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {filterOpen && (
            <div className={`${menuCls} left-0 top-full mt-1.5`}>
              <p className="px-3.5 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Opt-in status
              </p>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => { setStatusFilter(f.value); setFilterOpen(false); }}
                  className={menuItemCls}
                >
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${statusFilter === f.value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {statusFilter === f.value && <Check className="h-2.5 w-2.5" />}
                  </span>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs sm:flex-none lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="h-9 w-full rounded-lg border border-border bg-card pl-9 pr-8 text-[13px] shadow-sm outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          {loading && (
            <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {hasSelection && (
            <div className="relative" data-bulk-actions>
              <button
                type="button"
                onClick={() => setActionsOpen((v) => !v)}
                disabled={busy || deleting}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
              >
                {(busy || deleting) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {selectedIds.size} selected
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {actionsOpen && (
                <div className={`${menuCls} right-0 top-full mt-1.5 min-w-[230px]`}>
                  {onAddToLists && (
                    <button type="button" className={menuItemCls} onClick={() => { setAddOpen(true); setActionsOpen(false); setPickedLists(new Set()); setListSearch(""); }}>
                      <ListPlus className="h-4 w-4 text-muted-foreground" /> Add to lists
                    </button>
                  )}
                  {onRemoveFromLists && (
                    <button type="button" className={menuItemCls} onClick={() => { setRemoveOpen(true); setActionsOpen(false); setRemoveLists(new Set()); setRemoveListSearch(""); }}>
                      <UserMinus className="h-4 w-4 text-muted-foreground" /> Remove from lists
                    </button>
                  )}
                  <button type="button" className={menuItemCls} onClick={() => { void handleCopyPhones(); setActionsOpen(false); }}>
                    <Copy className="h-4 w-4 text-muted-foreground" /> Copy phone numbers
                  </button>
                  <button
                    type="button"
                    className={menuItemCls}
                    onClick={() => {
                      downloadContactsCsv(
                        contacts.filter((c) => selectedIds.has(c.id)).map((c) => ({
                          firstName: c.firstName,
                          lastName: c.lastName,
                          mobile: c.mobile,
                          email: c.email,
                          optIn: c.status,
                          created: c.created,
                        })),
                      );
                      setActionsOpen(false);
                    }}
                  >
                    <Download className="h-4 w-4 text-muted-foreground" /> Export selected
                  </button>
                  {onUnsubscribeContacts && (
                    <button
                      type="button"
                      className={menuItemCls}
                      onClick={() => void runBulkAction(async () => { await onUnsubscribeContacts([...selectedIds]); showActionMessage("Contacts unsubscribed."); })}
                    >
                      <UserX className="h-4 w-4 text-muted-foreground" /> Mark unsubscribed
                    </button>
                  )}
                  {onDeleteContacts && (
                    <>
                      <div className="my-1 border-t border-border" />
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                        onClick={() => void handleDeleteSelected()}
                      >
                        <Trash2 className="h-4 w-4" /> Delete contacts
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Create menu */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary pl-3.5 pr-3 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
            >
              <UserPlus className="h-4 w-4" />
              Create Contact
              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
            </button>
            {menuOpen && (
              <div className={`${menuCls} right-0 top-full mt-1.5`}>
                <button type="button" className={menuItemCls} onClick={() => { setMenuOpen(false); onCreateOne(); }}>
                  <UserPlus className="h-4 w-4 text-muted-foreground" /> Create one contact
                </button>
                <button type="button" className={menuItemCls} onClick={() => { setMenuOpen(false); onImportList(); }}>
                  <Upload className="h-4 w-4 text-muted-foreground" /> Import from CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* List-picker popovers for bulk list actions */}
      {addOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]" onClick={() => setAddOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 fade-in duration-150" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-sm font-semibold text-foreground">Add to lists</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"} selected</p>
            <input
              autoFocus
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search lists…"
              className="mt-3 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <div className="mt-2 max-h-52 overflow-y-auto">
              {filteredLists.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No lists found.</p>}
              {filteredLists.map((l) => (
                <button key={l.id} type="button" onClick={() => togglePick(l.id)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${pickedLists.has(l.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {pickedLists.has(l.id) && <Check className="h-3 w-3" />}
                  </span>
                  {l.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAddOpen(false)} className="h-9 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60">Cancel</button>
              <button
                type="button"
                disabled={pickedLists.size === 0}
                onClick={() => {
                  const ids = [...pickedLists];
                  setAddOpen(false);
                  void runBulkAction(async () => { await onAddToLists?.([...selectedIds], ids); showActionMessage("Contacts added to lists."); });
                }}
                className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {removeOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-[1px]" onClick={() => setRemoveOpen(false)}>
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 fade-in duration-150" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-sm font-semibold text-foreground">Remove from lists</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{selectedIds.size} contact{selectedIds.size === 1 ? "" : "s"} selected</p>
            <input
              autoFocus
              value={removeListSearch}
              onChange={(e) => setRemoveListSearch(e.target.value)}
              placeholder="Search lists…"
              className="mt-3 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
            />
            <div className="mt-2 max-h-52 overflow-y-auto">
              {filteredRemoveLists.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">No lists found.</p>}
              {filteredRemoveLists.map((l) => (
                <button key={l.id} type="button" onClick={() => toggleRemovePick(l.id)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
                  <span className={`flex h-4 w-4 items-center justify-center rounded border ${removeLists.has(l.id) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                    {removeLists.has(l.id) && <Check className="h-3 w-3" />}
                  </span>
                  {l.name}
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setRemoveOpen(false)} className="h-9 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60">Cancel</button>
              <button
                type="button"
                disabled={removeLists.size === 0}
                onClick={() => {
                  const ids = [...removeLists];
                  setRemoveOpen(false);
                  void runBulkAction(async () => { await onRemoveFromLists?.([...selectedIds], ids); showActionMessage("Contacts removed from lists."); });
                }}
                className="h-9 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
          <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {isFiltering ? <Search className="h-5 w-5" /> : <Inbox className="h-5 w-5" />}
          </div>
          <h3 className="font-display text-sm font-semibold text-foreground">
            {isFiltering ? "No contacts match your filters" : "No contacts yet"}
          </h3>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            {isFiltering
              ? "Try a different search term or clear the status filter."
              : "Create your first contact or import a list to start sending reminders and campaigns."}
          </p>
          {!isFiltering && (
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={onCreateOne} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover">
                <UserPlus className="h-4 w-4" /> Create contact
              </button>
              <button type="button" onClick={onImportList} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60">
                <Upload className="h-4 w-4" /> Import CSV
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="w-10 px-4 py-2.5">
                    <input ref={selectAllRef} type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} className={checkCls} aria-label="Select all" />
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mobile</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
                  <th className="w-12 px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const selected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-border/70 transition-colors last:border-0 ${selected ? "bg-primary/[0.04]" : "hover:bg-muted/40"}`}
                    >
                      <td className="px-4 py-2.5">
                        <input type="checkbox" checked={selected} onChange={() => toggleRow(c.id)} className={checkCls} aria-label={`Select ${contactName(c)}`} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {initials(c)}
                          </span>
                          <span className="max-w-[200px] truncate font-medium text-foreground">{contactName(c)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{displayMobile(c.mobile)}</td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-muted-foreground">{c.email || "—"}</td>
                      <td className="px-4 py-2.5"><StatusPill status={c.status} /></td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{c.created || "—"}</td>
                      <td className="relative px-4 py-2.5">
                        <button
                          type="button"
                          onClick={() => setRowMenuFor(rowMenuFor === c.id ? null : c.id)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {rowMenuFor === c.id && (
                          <div ref={rowMenuRef} className={`${menuCls} right-4 top-full z-40 mt-0.5 min-w-[180px]`}>
                            <button
                              type="button"
                              className={menuItemCls}
                              onClick={() => {
                                if (!c.mobile) return;
                                void navigator.clipboard.writeText(c.mobile).then(
                                  () => showActionMessage("Phone number copied."),
                                  () => showActionMessage("Could not copy.", true),
                                );
                                setRowMenuFor(null);
                              }}
                            >
                              <Copy className="h-4 w-4 text-muted-foreground" /> Copy phone
                            </button>
                            {onUnsubscribeContacts && c.status === "Subscribed" && (
                              <button
                                type="button"
                                className={menuItemCls}
                                onClick={() => {
                                  setRowMenuFor(null);
                                  void Promise.resolve(onUnsubscribeContacts([c.id])).then(() =>
                                    showActionMessage("Contact unsubscribed."),
                                  );
                                }}
                              >
                                <UserX className="h-4 w-4 text-muted-foreground" /> Unsubscribe
                              </button>
                            )}
                            {onMergeContact && (
                              <button
                                type="button"
                                className={menuItemCls}
                                onClick={() => {
                                  setRowMenuFor(null);
                                  onMergeContact(c);
                                }}
                              >
                                <UserMinus className="h-4 w-4 text-muted-foreground" /> Merge duplicate
                              </button>
                            )}
                            {onDeleteContacts && (
                              <>
                                <div className="my-1 border-t border-border" />
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                                  onClick={() => void handleDeleteOne(c)}
                                >
                                  <Trash2 className="h-4 w-4" /> Delete
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {filtered.length.toLocaleString()} contact{filtered.length === 1 ? "" : "s"}
              {isFiltering ? " (filtered)" : ""}
            </span>
            {hasSelection && (
              <button type="button" onClick={clearSelection} className="font-medium text-primary transition-colors hover:text-primary-hover">
                Clear selection
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
