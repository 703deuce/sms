"use client";
import { useMemo, useState } from "react";
import { Users, UserCheck, UserX, Search, Filter, ChevronDown, X, UserPlus, UserMinus, Download, Ban, Trash2, ListPlus, Info, ArrowUpDown } from "lucide-react";
import { Contact, ContactList, contactStats } from "../mock-data";

interface Props {
  contacts: Contact[];
  lists: ContactList[];
  onAddToLists: (contactIds: string[], listIds: string[]) => void;
}

export default function ContactsPage({ contacts, lists, onAddToLists }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [pickedLists, setPickedLists] = useState<Set<string>>(new Set());
  const [listSearch, setListSearch] = useState("");
  const [search, setSearch] = useState("");

  const visible = useMemo(
    () => contacts.filter((c) => (c.firstName + " " + c.lastName).toLowerCase().includes(search.toLowerCase())),
    [contacts, search]
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

  const filteredLists = lists.filter((l) => l.name.toLowerCase().includes(listSearch.toLowerCase()));

  const stats = [
    { label: "Contacts", value: contactStats.total.toLocaleString(), icon: <Users size={16} />, tone: "bg-[#eef1fe] text-[#3b4ef5]" },
    { label: "Subscribed Contacts", value: contactStats.subscribed.toLocaleString(), icon: <UserCheck size={16} />, tone: "bg-[#e7f8f0] text-[#12b76a]" },
    { label: "Unsubscribed Contacts", value: String(contactStats.unsubscribed), icon: <UserX size={16} />, tone: "bg-[#feeeef] text-[#f04438]" },
  ];

  return (
    <div onClick={() => actionsOpen && setActionsOpen(false)}>
      <h1 className="page-title"><Users size={19} className="text-[#3b4ef5]" /> Contacts</h1>
      <p className="page-subtitle mb-5">View and manage all of your contacts.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="metric-card">
            <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${s.tone}`}>{s.icon}</span>
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-[#7a85a8]">
              {s.label} <Info size={11} className="text-[#c3c9dd]" />
            </div>
            <div className="text-[20px] font-bold tracking-tight text-[#0f1b3d] tabular-nums leading-none">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 relative" onClick={(e) => e.stopPropagation()}>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setFiltersOpen(true)}>
            <Filter size={13} /> Filter
          </button>
          {selected.size > 0 && (
            <div className="relative">
              <button className="btn-secondary flex items-center gap-1.5 border-[#3b4ef5]/40 text-[#3b4ef5]" onClick={() => setActionsOpen(!actionsOpen)}>
                Actions ({selected.size}) <ChevronDown size={13} />
              </button>
              {actionsOpen && (
                <div className="menu-pop w-[220px]">
                  {[
                    { icon: <UserPlus size={14} />, label: "Add to Lists", fn: () => { setActionsOpen(false); setAddOpen(true); } },
                    { icon: <UserMinus size={14} />, label: "Remove From Lists", fn: () => setActionsOpen(false) },
                    { icon: <Download size={14} />, label: "Download", fn: () => setActionsOpen(false) },
                    { icon: <Ban size={14} />, label: "Unsubscribe", fn: () => setActionsOpen(false) },
                    { icon: <Ban size={14} />, label: "Unsubscribe & Delete", fn: () => setActionsOpen(false) },
                    { icon: <Trash2 size={14} />, label: "Delete", fn: () => setActionsOpen(false), danger: true },
                  ].map((a) => (
                    <div key={a.label} onClick={a.fn} className={`menu-item ${a.danger ? "text-[#f04438]" : ""}`}>
                      {a.icon} {a.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            <input className="input pl-8 w-[220px]" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="btn-primary flex items-center gap-1.5"><UserPlus size={14} /> Create Contact <ChevronDown size={12} /></button>
        </div>
      </div>

      <div className="table-card">
        {selected.size === visible.length && visible.length > 0 && (
          <div className="px-5 py-2 bg-[#eef1fe] text-[12px] text-[#3b4ef5] text-center border-b border-[#eceef5]">
            All {visible.length} contacts on this page are selected. <span className="font-semibold underline cursor-pointer">Select all {contactStats.total.toLocaleString()} contacts.</span>
          </div>
        )}
        <div className="table-head grid grid-cols-[36px_1fr_1fr_1.1fr_1.2fr_1.2fr_1.3fr_32px]">
          <input type="checkbox" className="checkbox" checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} />
          <span className="flex items-center gap-1">FIRST NAME <ArrowUpDown size={10} /></span>
          <span>LAST NAME</span><span>MOBILE NUMBER</span><span>EMAIL</span><span>OPT-IN STATUS</span><span>CREATED</span><span></span>
        </div>
        {visible.map((c) => (
          <div key={c.id} className={`table-row grid grid-cols-[36px_1fr_1fr_1.1fr_1.2fr_1.2fr_1.3fr_32px] ${selected.has(c.id) ? "bg-[#fafbff]" : ""}`}>
            <input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            <span className="text-[13px] font-medium text-[#3b4ef5] cursor-pointer hover:underline">{c.firstName}</span>
            <span className="text-[13px] text-[#0f1b3d]">{c.lastName}</span>
            <span className="cell-body">{c.mobile}</span>
            <span className="cell-body">{c.email || "—"}</span>
            <span>
              <span className={`pill ${c.optIn === "Subscribed" ? "pill-green" : "pill-gray"}`}>{c.optIn}</span>
            </span>
            <span className="text-[12.5px] text-[#7a85a8]">{c.created}</span>
            <Info size={13} className="text-[#c3c9dd] cursor-pointer hover:text-[#7a85a8]" />
          </div>
        ))}
        {visible.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-[#7a85a8]">No contacts match your search.</div>
        )}
      </div>

      {filtersOpen && (
        <div className="modal-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="modal-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1b3d]"><Filter size={15} className="text-[#3b4ef5]" /> Contact Filters</h3>
              <X size={16} className="text-[#9aa3c0] cursor-pointer hover:text-[#44507a]" onClick={() => setFiltersOpen(false)} />
            </div>
            {["Audience", "Source", "Opt-In Status"].map((f) => (
              <div key={f} className="mb-4">
                <label className="field-label">{f}</label>
                <input className="input" placeholder="Search" />
              </div>
            ))}
            <div className="flex gap-3 mt-6">
              <button className="btn-primary" onClick={() => setFiltersOpen(false)}>Apply 0 Filters</button>
              <button className="btn-secondary" onClick={() => setFiltersOpen(false)}>Clear Filters</button>
            </div>
          </div>
        </div>
      )}

      {addOpen && (
        <div className="modal-overlay" onClick={() => setAddOpen(false)}>
          <div className="modal-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1b3d]"><ListPlus size={15} className="text-[#3b4ef5]" /> Add to Lists</h3>
              <X size={16} className="text-[#9aa3c0] cursor-pointer hover:text-[#44507a]" onClick={() => setAddOpen(false)} />
            </div>
            <p className="text-[12px] text-[#7a85a8] mb-4">Select up to 5 lists to add your selected contacts to.</p>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
              <input className="input pl-8" placeholder="Search" value={listSearch} onChange={(e) => setListSearch(e.target.value)} />
            </div>
            <div className="border border-[#eceef5] rounded-lg divide-y divide-[#f1f3f9] mb-5 overflow-hidden">
              {filteredLists.map((l) => (
                <label key={l.id} className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-[#fafbfe] transition-colors">
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
    </div>
  );
}
