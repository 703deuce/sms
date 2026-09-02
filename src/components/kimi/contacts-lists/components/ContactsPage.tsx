"use client";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Users, UserCheck, UserX, Search, Filter, ChevronDown, X, UserPlus, UserMinus, Download, Ban, Trash2, ListPlus, Info, ArrowUpDown, Upload } from "lucide-react";
import { Contact, ContactList } from "../mock-data";
import type { KimiContactStats } from "@/lib/contacts/kimi-contacts-adapter";
import { downloadContactsCsv } from "@/lib/contacts/download-csv";

interface Props {
  contacts: Contact[];
  lists: ContactList[];
  stats: KimiContactStats;
  onAddToLists: (contactIds: string[], listIds: string[]) => void;
  onRemoveFromLists?: (contactIds: string[], listIds: string[]) => void | Promise<void>;
  onDeleteContacts?: (contactIds: string[]) => void | Promise<void>;
  onUnsubscribeContacts?: (contactIds: string[]) => void | Promise<void>;
}

export default function ContactsPage({
  contacts,
  lists,
  stats,
  onAddToLists,
  onRemoveFromLists,
  onDeleteContacts,
  onUnsubscribeContacts,
}: Props) {
  const createMenuRef = useRef<HTMLDivElement | null>(null);
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
  const [statusFilter, setStatusFilter] = useState<"all" | "Subscribed" | "Unsubscribed" | "Not Subscribed">("all");

  const visible = useMemo(
    () =>
      contacts.filter((c) => {
        if (statusFilter !== "all" && c.optIn !== statusFilter) return false;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const haystack = `${c.firstName} ${c.lastName} ${c.mobile} ${c.email || ""}`.toLowerCase();
        return haystack.includes(q);
      }),
    [contacts, search, statusFilter],
  );

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    setSelected(selected.size === visible.length ? new Set() : new Set(visible.map((c) => c.id)));
  };
  const togglePick = (id: string) => {
    const s = new Set(pickedLists);
    s.has(id) ? s.delete(id) : s.add(id);
    setPickedLists(s);
  };
  const toggleRemovePick = (id: string) => {
    const s = new Set(removeLists);
    s.has(id) ? s.delete(id) : s.add(id);
    setRemoveLists(s);
  };

  const filteredLists = lists.filter((l) => l.name.toLowerCase().includes(listSearch.toLowerCase()));
  const filteredRemoveLists = lists.filter((l) => l.name.toLowerCase().includes(removeListSearch.toLowerCase()));
  const selectedContacts = contacts.filter((c) => selected.has(c.id));
  const allLoadedSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));

  const selectAllLoaded = () => {
    setSelected(new Set(contacts.map((c) => c.id)));
  };

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

  return (
    <div onClick={() => { if (actionsOpen) setActionsOpen(false); if (createOpen) setCreateOpen(false); }}>
      <h1 className="page-title"><Users size={19} className="text-[#3b4ef5]" /> Contacts</h1>
      <p className="page-subtitle mb-6">View and manage all of your contacts.</p>

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

      <div className="flex items-center justify-between mb-4">
        <div className="relative flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setFiltersOpen(true)}>
            <Filter size={13} /> Filter
          </button>
          {selected.size > 0 && (
            <div className="relative">
              <button className="btn-secondary flex items-center gap-1.5 border-[#3b4ef5]/40 text-[#3b4ef5]" onClick={() => setActionsOpen(!actionsOpen)}>
                Actions ({selected.size}) <ChevronDown size={13} className={`transition-transform ${actionsOpen ? "rotate-180" : ""}`} />
              </button>
              {actionsOpen && (
                <div className="menu-pop w-[220px]">
                  {[
                    { icon: <UserPlus size={14} />, label: "Add to Lists", fn: () => { setActionsOpen(false); setAddOpen(true); } },
                    {
                      icon: <UserMinus size={14} />,
                      label: "Remove From Lists",
                      fn: () => { setActionsOpen(false); setRemoveOpen(true); },
                    },
                    {
                      icon: <Download size={14} />,
                      label: "Download",
                      fn: () => void runBulkAction(async () => {
                        downloadContactsCsv(
                          selectedContacts,
                          `contacts-selected-${new Date().toISOString().slice(0, 10)}.csv`,
                        );
                      }),
                    },
                    {
                      icon: <Ban size={14} />,
                      label: "Unsubscribe",
                      fn: () => void runBulkAction(async () => {
                        if (onUnsubscribeContacts) await onUnsubscribeContacts(Array.from(selected));
                      }),
                    },
                    {
                      icon: <Ban size={14} />,
                      label: "Unsubscribe & Delete",
                      fn: () => void runBulkAction(async () => {
                        if (onUnsubscribeContacts) await onUnsubscribeContacts(Array.from(selected));
                        if (onDeleteContacts) await onDeleteContacts(Array.from(selected));
                      }),
                    },
                    {
                      icon: <Trash2 size={14} />,
                      label: "Delete",
                      fn: () => void runBulkAction(async () => {
                        if (onDeleteContacts) await onDeleteContacts(Array.from(selected));
                      }),
                      danger: true,
                    },
                  ].map((a) => (
                    <div key={a.label} onClick={a.fn} className={`menu-item ${a.danger ? "text-[#f04438] hover:bg-[#feeeef]" : ""}`}>
                      {a.icon} {a.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            <input className="input pl-8 w-[220px]" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative" ref={createMenuRef}>
            <button
              className="btn-primary flex items-center gap-1.5"
              onClick={() => setCreateOpen(!createOpen)}
            >
              <UserPlus size={14} /> Create Contact <ChevronDown size={12} className={`transition-transform ${createOpen ? "rotate-180" : ""}`} />
            </button>
            {createOpen && (
              <div className="menu-pop right-0 left-auto mt-1.5 w-48">
                <button
                  className="menu-item w-full"
                  onClick={() => { setCreateOpen(false); window.location.assign("/contacts/create"); }}
                >
                  <UserPlus size={14} /> Create One
                </button>
                <button
                  className="menu-item w-full"
                  onClick={() => { setCreateOpen(false); window.location.assign("/contacts/imports"); }}
                >
                  <Upload size={14} /> Import List
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="table-card">
        {selected.size === visible.length && visible.length > 0 && !allLoadedSelected && (
          <div className="border-b border-[#eceef5] bg-[#eef1fe] px-5 py-2 text-center text-[12px] text-[#3b4ef5]">
            All {visible.length} contacts on this page are selected.{" "}
            <button type="button" className="cursor-pointer font-semibold underline" onClick={selectAllLoaded}>
              Select all {contacts.length.toLocaleString()} loaded contacts.
            </button>
          </div>
        )}
        {allLoadedSelected && contacts.length > 0 && (
          <div className="border-b border-[#eceef5] bg-[#eef1fe] px-5 py-2 text-center text-[12px] text-[#3b4ef5]">
            All {contacts.length.toLocaleString()} loaded contacts are selected.
          </div>
        )}
        <div className="table-head grid grid-cols-[36px_1fr_1fr_1.1fr_1.2fr_1.2fr_1.3fr_32px]">
          <input type="checkbox" className="checkbox" checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} />
          <span className="flex items-center gap-1">FIRST NAME <ArrowUpDown size={10} /></span>
          <span>LAST NAME</span><span>MOBILE NUMBER</span><span>EMAIL</span><span>OPT-IN STATUS</span><span>CREATED</span><span></span>
        </div>
        {visible.map((c) => (
          <div key={c.id} className={`table-row grid grid-cols-[36px_1fr_1fr_1.1fr_1.2fr_1.2fr_1.3fr_32px] transition-colors ${selected.has(c.id) ? "bg-[#f4f6ff]" : "hover:bg-[#fafbfe]"}`}>
            <input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            <Link href={`/contacts/${c.id}`} className="text-[13px] font-medium text-[#3b4ef5] hover:underline">
              {c.firstName}
            </Link>
            <Link
              href={`/contacts/${c.id}`}
              className="text-[13px] text-[#0f1b3d] hover:text-[#3b4ef5] hover:underline"
            >
              {c.lastName}
            </Link>
            <span className="cell-body">{c.mobile}</span>
            <span className="cell-body">{c.email || <span className="text-[#c3c9dd]">—</span>}</span>
            <span>
              <span className={`pill ${c.optIn === "Subscribed" ? "pill-green" : "pill-gray"}`}>{c.optIn}</span>
            </span>
            <span className="text-[12.5px] text-[#7a85a8]">{c.created}</span>
            <Link
              href={`/contacts/${c.id}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[#c3c9dd] transition-colors hover:bg-[#eef1fe] hover:text-[#7a85a8]"
              title="View contact"
            >
              <Info size={13} />
            </Link>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef1fe] text-[#3b4ef5]"><UserX size={18} /></span>
            <div className="text-[13px] font-semibold text-[#0f1b3d]">No contacts found</div>
            <div className="mt-1 text-[12.5px] text-[#7a85a8]">No contacts match your search. Try a different term.</div>
          </div>
        )}
      </div>

      {filtersOpen && (
        <div className="modal-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="modal-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1b3d]"><Filter size={15} className="text-[#3b4ef5]" /> Contact Filters</h3>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#9aa3c0] transition-colors hover:bg-[#f1f3f9] hover:text-[#44507a]" onClick={() => setFiltersOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="mb-4">
              <label className="field-label">Opt-In Status</label>
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="Subscribed">Subscribed</option>
                <option value="Unsubscribed">Unsubscribed</option>
                <option value="Not Subscribed">Not Subscribed</option>
              </select>
            </div>
            <div className="mt-6 flex gap-3">
              <button className="btn-primary" onClick={() => setFiltersOpen(false)}>
                Apply {statusFilter === "all" ? "0" : "1"} Filter{statusFilter === "all" ? "s" : ""}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setStatusFilter("all");
                  setFiltersOpen(false);
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1b3d]"><ListPlus size={15} className="text-[#3b4ef5]" /> Add to Lists</h3>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#9aa3c0] transition-colors hover:bg-[#f1f3f9] hover:text-[#44507a]" onClick={() => setAddOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-[12px] text-[#7a85a8]">Select up to 5 lists to add your selected contacts to.</p>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
              <input className="input pl-8" placeholder="Search" value={listSearch} onChange={(e) => setListSearch(e.target.value)} />
            </div>
            <div className="mb-5 divide-y divide-[#f1f3f9] overflow-hidden rounded-lg border border-[#eceef5]">
              {filteredLists.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-[#fafbfe]">
                  <input type="checkbox" className="checkbox" checked={pickedLists.has(l.id)} onChange={() => togglePick(l.id)} />
                  <span className="text-[13px] text-[#0f1b3d]">{l.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="btn-primary"
                disabled={pickedLists.size === 0}
                onClick={() => { onAddToLists(Array.from(selected), Array.from(pickedLists)); setAddOpen(false); setPickedLists(new Set()); setSelected(new Set()); }}
              >
                Add to Lists
              </button>
              <button className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {removeOpen && (
        <div className="modal-overlay" onClick={() => setRemoveOpen(false)}>
          <div className="modal-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1b3d]"><UserMinus size={15} className="text-[#3b4ef5]" /> Remove From Lists</h3>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#9aa3c0] transition-colors hover:bg-[#f1f3f9] hover:text-[#44507a]" onClick={() => setRemoveOpen(false)}>
                <X size={16} />
              </button>
            </div>
            <p className="mb-4 text-[12px] text-[#7a85a8]">Select lists to remove your selected contacts from.</p>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
              <input className="input pl-8" placeholder="Search" value={removeListSearch} onChange={(e) => setRemoveListSearch(e.target.value)} />
            </div>
            <div className="mb-5 divide-y divide-[#f1f3f9] overflow-hidden rounded-lg border border-[#eceef5]">
              {filteredRemoveLists.map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-[#fafbfe]">
                  <input type="checkbox" className="checkbox" checked={removeLists.has(l.id)} onChange={() => toggleRemovePick(l.id)} />
                  <span className="text-[13px] text-[#0f1b3d]">{l.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                className="btn-primary"
                disabled={removeLists.size === 0 || busy}
                onClick={() => void runBulkAction(async () => {
                  if (onRemoveFromLists) {
                    await onRemoveFromLists(Array.from(selected), Array.from(removeLists));
                  }
                  setRemoveOpen(false);
                  setRemoveLists(new Set());
                })}
              >
                Remove From Lists
              </button>
              <button className="btn-secondary" onClick={() => setRemoveOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
