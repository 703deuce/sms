"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Users, UserCheck, UserX, Search, Filter, ChevronDown, X, UserPlus, UserMinus,
  Download, Ban, Trash2, ListPlus, Info, ArrowUpDown, ArrowUp, ArrowDown, Check, Upload,
} from "lucide-react";
import { Contact, ContactList } from "../mock-data";

interface Stats { contacts: number; subscribed: number; unsubscribed: number }

interface Props {
  contacts: Contact[];
  lists: ContactList[];
  stats: Stats;
  selectedListId?: string | null;
  onClearListFilter?: () => void;
  onAddToLists: (contactIds: string[], listIds: string[]) => void;
  onRemoveFromLists: (contactIds: string[], listIds: string[]) => void;
  onDeleteContacts: (contactIds: string[]) => void;
  onUnsubscribeContacts: (contactIds: string[]) => void;
}

function downloadCsv(rows: Contact[]) {
  const header = "First Name,Last Name,Mobile,Email,Opt-In,Created\n";
  const body = rows.map((c) => [c.firstName, c.lastName, c.mobile, c.email, c.optIn, c.created].map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "contacts.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ContactsPage({
  contacts, lists, stats, selectedListId, onClearListFilter,
  onAddToLists, onRemoveFromLists, onDeleteContacts, onUnsubscribeContacts,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pickedLists, setPickedLists] = useState<Set<string>>(new Set());
  const [removeLists, setRemoveLists] = useState<Set<string>>(new Set());
  const [listSearch, setListSearch] = useState("");
  const [removeListSearch, setRemoveListSearch] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "Subscribed" | "Unsubscribed" | "Not Subscribed">("all");

  const activeList = lists.find((l) => l.id === selectedListId) ?? null;

  const anyOverlayOpen = filtersOpen || addOpen || removeOpen;
  useEffect(() => {
    if (!anyOverlayOpen) return;
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setFiltersOpen(false);
        setAddOpen(false);
        setRemoveOpen(false);
      }
    };
    document.addEventListener("keydown", keyHandler);
    return () => document.removeEventListener("keydown", keyHandler);
  }, [anyOverlayOpen]);

  const visible = useMemo(() => {
    const filtered = contacts.filter((c) => {
      if (statusFilter !== "all" && c.optIn !== statusFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return `${c.firstName} ${c.lastName} ${c.mobile} ${c.email || ""}`.toLowerCase().includes(q);
    });
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const an = `${a.firstName} ${a.lastName}`;
      const bn = `${b.firstName} ${b.lastName}`;
      return sortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
    });
  }, [contacts, search, statusFilter, sortDir]);

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) { s.delete(id); } else { s.add(id); }
    setSelected(s);
  };
  const toggleAll = () => setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((c) => c.id)));
  const toggleIn = (set: Set<string>, id: string, apply: (s: Set<string>) => void) => {
    const s = new Set(set);
    if (s.has(id)) { s.delete(id); } else { s.add(id); }
    apply(s);
  };
  const toggleSort = () => setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");

  const filteredLists = lists.filter((l) => l.name.toLowerCase().includes(listSearch.toLowerCase()));
  const filteredRemoveLists = lists.filter((l) => l.name.toLowerCase().includes(removeListSearch.toLowerCase()));

  const statCards = [
    { label: "Contacts", value: stats.contacts.toLocaleString(), icon: <Users size={16} />, tone: "bg-[#eef1fe] text-[#3b4ef5]" },
    { label: "Subscribed Contacts", value: stats.subscribed.toLocaleString(), icon: <UserCheck size={16} />, tone: "bg-[#e7f8f0] text-[#12b76a]" },
    { label: "Unsubscribed Contacts", value: String(stats.unsubscribed), icon: <UserX size={16} />, tone: "bg-[#feeeef] text-[#f04438]" },
  ];

  const runBulkAction = async (action: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setActionsOpen(false);
    try {
      await action();
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const optInChip = (v: Contact["optIn"]) =>
    v === "Subscribed" ? <span className="chip chip-green">Subscribed</span>
    : v === "Unsubscribed" ? <span className="chip chip-red">Unsubscribed</span>
    : <span className="chip chip-gray">Not Subscribed</span>;

  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div onClick={() => { if (actionsOpen) setActionsOpen(false); if (createOpen) setCreateOpen(false); }}>
      <h1 className="page-title"><Users size={19} className="text-[#3b4ef5]" /> Contacts</h1>
      <p className="page-subtitle mb-6">View and manage all of your contacts.</p>

      {activeList && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-[#dce2ff] bg-[#eef1fe] px-4 py-2.5 text-[12px] text-[#3b4ef5]">
          <span>Filtered by list: <strong>{activeList.name}</strong></span>
          <button className="flex items-center gap-1 font-semibold hover:underline" onClick={onClearListFilter}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {stats.contacts > contacts.length && (
        <div className="mb-4 rounded-lg border border-[#dce2ff] bg-[#eef1fe] px-4 py-2.5 text-[12px] text-[#3b4ef5]">
          Showing {contacts.length.toLocaleString()} of {stats.contacts.toLocaleString()} contacts. Refine your search or use filters to find specific contacts.
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-7">
        {statCards.map((s) => (
          <div key={s.label} className="metric-card transition-shadow hover:shadow-md">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${s.tone}`}>{s.icon}</span>
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#7a85a8]">
              {s.label} <Info size={11} className="text-[#c3c9dd]" />
            </div>
            <div className="text-[20px] font-bold leading-none tracking-tight tabular-nums text-[#0f1b3d]">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4 toolbar-stack gap-3">
        <div className="relative flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button className="btn-secondary" onClick={() => setFiltersOpen(true)}><Filter size={13} /> Filter</button>
          {selected.size > 0 && (
            <div className="relative">
              <button className="btn-secondary border-[#3b4ef5]/40 text-[#3b4ef5]" onClick={() => setActionsOpen(!actionsOpen)} aria-expanded={actionsOpen}>
                Actions ({selected.size}) <ChevronDown size={13} className={`transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
              </button>
              {actionsOpen && (
                <div className="menu-pop left-0 mt-1 w-52" role="menu">
                  <button className="menu-item" role="menuitem" onClick={() => { setAddOpen(true); setActionsOpen(false); }}><ListPlus size={14} /> Add to Lists</button>
                  <button className="menu-item" role="menuitem" onClick={() => { setRemoveOpen(true); setActionsOpen(false); }}><UserMinus size={14} /> Remove from Lists</button>
                  <button className="menu-item" role="menuitem" onClick={() => void runBulkAction(() => downloadCsv(contacts.filter((c) => selected.has(c.id))))}><Download size={14} /> Export CSV</button>
                  <button className="menu-item" role="menuitem" onClick={() => void runBulkAction(() => onUnsubscribeContacts(Array.from(selected)))}><Ban size={14} /> Unsubscribe</button>
                  <button className="menu-item text-[#f04438] hover:bg-[#feeeef]" role="menuitem" onClick={() => void runBulkAction(() => onDeleteContacts(Array.from(selected)))}><Trash2 size={14} /> Delete</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            <input className="input pl-8 w-[220px]" placeholder="Search contacts" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search contacts" />
          </div>
          <div className="relative">
            <button className="btn-primary" onClick={() => setCreateOpen(!createOpen)} aria-expanded={createOpen}>
              <UserPlus size={14} /> Add Contact <ChevronDown size={12} />
            </button>
            {createOpen && (
              <div className="menu-pop right-0 mt-1 w-48" role="menu">
                <button className="menu-item" role="menuitem" onClick={() => setCreateOpen(false)}><UserPlus size={14} /> Create Contact</button>
                <button className="menu-item" role="menuitem" onClick={() => setCreateOpen(false)}><Upload size={14} /> Import Contacts</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="table-head grid grid-cols-[32px_1.2fr_1fr_1.2fr_150px_1.2fr]">
          <span
            className={`checkbox ${visible.length > 0 && selected.size === visible.length ? "checked" : ""}`}
            onClick={toggleAll}
            role="checkbox"
            aria-checked={visible.length > 0 && selected.size === visible.length}
            aria-label="Select all contacts"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleAll(); } }}
          >
            {visible.length > 0 && selected.size === visible.length && <Check size={11} />}
          </span>
          <button
            className="flex items-center gap-1 cursor-pointer hover:text-[#44507a] bg-transparent border-0 p-0 text-inherit"
            onClick={toggleSort}
            aria-label={`Sort by name ${sortDir === "asc" ? "descending" : "ascending"}`}
          >
            NAME <SortIcon size={11} />
          </button>
          <span>MOBILE</span>
          <span className="hide-md">EMAIL</span>
          <span>OPT-IN</span>
          <span className="hide-sm">CREATED</span>
        </div>
        {visible.map((c) => (
          <div key={c.id} className="table-row grid grid-cols-[32px_1.2fr_1fr_1.2fr_150px_1.2fr] hover:bg-[#fafbfe]">
            <span
              className={`checkbox ${selected.has(c.id) ? "checked" : ""}`}
              onClick={() => toggle(c.id)}
              role="checkbox"
              aria-checked={selected.has(c.id)}
              aria-label={`Select ${c.firstName} ${c.lastName}`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(c.id); } }}
            >
              {selected.has(c.id) && <Check size={11} />}
            </span>
            <div className="cell-primary">{c.firstName} {c.lastName}</div>
            <div className="cell-body tabular-nums">{c.mobile}</div>
            <div className="cell-body hide-md">{c.email || <span className="text-[#c3c9dd]">—</span>}</div>
            <div>{optInChip(c.optIn)}</div>
            <div className="cell-sub hide-sm">{c.created}</div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef1fe] text-[#3b4ef5]"><Users size={18} /></span>
            <div className="text-[13px] font-semibold text-[#0f1b3d]">No contacts found</div>
            <div className="mt-1 text-[12.5px] text-[#7a85a8]">No contacts match your current search or filters.</div>
            {(search || statusFilter !== "all") && (
              <button className="btn-secondary mt-4" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Clear search & filters</button>
            )}
          </div>
        )}
        <div className="table-footer">
          <select className="input w-auto text-[12px] py-1.5" aria-label="Rows per page">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
          <span className="text-[12px] text-[#9aa3c0]">{visible.length} contact{visible.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {filtersOpen && (
        <div className="modal-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Filter contacts" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f3f9]">
              <div className="text-[14px] font-bold text-[#0f1b3d]">Filter Contacts</div>
              <button className="text-[#9aa3c0] hover:text-[#0f1b3d]" onClick={() => setFiltersOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="px-5 py-4">
              <label className="field-label">Opt-In Status</label>
              <div className="seg-control w-full">
                {(["all", "Subscribed", "Not Subscribed", "Unsubscribed"] as const).map((o) => (
                  <button key={o} className={`seg-option flex-1 ${statusFilter === o ? "active" : ""}`} onClick={() => setStatusFilter(o)}>
                    {o === "all" ? "All" : o}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-[#f1f3f9]">
              <button className="btn-primary flex-1" onClick={() => setFiltersOpen(false)}>Apply Filters</button>
              <button className="btn-secondary" onClick={() => { setStatusFilter("all"); setFiltersOpen(false); }}>Clear</button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Add contacts to lists" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f3f9]">
              <div className="text-[14px] font-bold text-[#0f1b3d]">Add {selected.size} Contact{selected.size === 1 ? "" : "s"} to Lists</div>
              <button className="text-[#9aa3c0] hover:text-[#0f1b3d]" onClick={() => setAddOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="px-5 py-4">
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
                <input className="input pl-8" placeholder="Search lists" value={listSearch} onChange={(e) => setListSearch(e.target.value)} aria-label="Search lists" />
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-1">
                {filteredLists.map((l) => (
                  <div key={l.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#fafbfe] cursor-pointer" onClick={() => toggleIn(pickedLists, l.id, setPickedLists)}>
                    <span className={`checkbox ${pickedLists.has(l.id) ? "checked" : ""}`}>{pickedLists.has(l.id) && <Check size={11} />}</span>
                    <div>
                      <div className="text-[13px] font-semibold text-[#0f1b3d]">{l.name}</div>
                      <div className="text-[11px] text-[#9aa3c0]">{l.contacts.toLocaleString()} contacts</div>
                    </div>
                  </div>
                ))}
                {filteredLists.length === 0 && <div className="py-6 text-center text-[12.5px] text-[#7a85a8]">No lists match your search.</div>}
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-[#f1f3f9]">
              <button className="btn-primary flex-1" disabled={pickedLists.size === 0} onClick={() => { onAddToLists(Array.from(selected), Array.from(pickedLists)); setAddOpen(false); setPickedLists(new Set()); setSelected(new Set()); }}>
                Add to {pickedLists.size} List{pickedLists.size === 1 ? "" : "s"}
              </button>
              <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {removeOpen && (
        <div className="modal-overlay" onClick={() => setRemoveOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Remove contacts from lists" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#f1f3f9]">
              <div className="text-[14px] font-bold text-[#0f1b3d]">Remove {selected.size} Contact{selected.size === 1 ? "" : "s"} from Lists</div>
              <button className="text-[#9aa3c0] hover:text-[#0f1b3d]" onClick={() => setRemoveOpen(false)} aria-label="Close"><X size={16} /></button>
            </div>
            <div className="px-5 py-4">
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
                <input className="input pl-8" placeholder="Search lists" value={removeListSearch} onChange={(e) => setRemoveListSearch(e.target.value)} aria-label="Search lists" />
              </div>
              <div className="max-h-[220px] overflow-y-auto space-y-1">
                {filteredRemoveLists.map((l) => (
                  <div key={l.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[#fafbfe] cursor-pointer" onClick={() => toggleIn(removeLists, l.id, setRemoveLists)}>
                    <span className={`checkbox ${removeLists.has(l.id) ? "checked" : ""}`}>{removeLists.has(l.id) && <Check size={11} />}</span>
                    <div>
                      <div className="text-[13px] font-semibold text-[#0f1b3d]">{l.name}</div>
                      <div className="text-[11px] text-[#9aa3c0]">{l.contacts.toLocaleString()} contacts</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-[#f1f3f9]">
              <button className="btn-primary flex-1" disabled={removeLists.size === 0} onClick={() => { onRemoveFromLists(Array.from(selected), Array.from(removeLists)); setRemoveOpen(false); setRemoveLists(new Set()); setSelected(new Set()); }}>
                Remove from {removeLists.size} List{removeLists.size === 1 ? "" : "s"}
              </button>
              <button className="btn-secondary" onClick={() => setRemoveOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
