"use client";
import { useMemo, useState } from "react";
import { Users, UserCheck, UserX, Search, Filter, ChevronDown, X, UserPlus, UserMinus, Download, Ban, Trash2, ListPlus } from "lucide-react";
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

  return (
    <div className="p-8 max-w-[1100px]" onClick={() => actionsOpen && setActionsOpen(false)}>
      <h1 className="flex items-center gap-2 text-[20px] font-bold text-[#0f1b3d]">
        <Users size={20} className="text-[#3b4ef5]" /> Contacts
      </h1>
      <p className="text-[13px] text-[#7a85a8] mt-0.5 mb-5">View and manage all of your contacts.</p>

      <div className="flex gap-4 mb-6">
        <div className="stat-card">
          <span className="w-9 h-9 rounded-full bg-[#eef1fe] text-[#3b4ef5] flex items-center justify-center"><Users size={16} /></span>
          <div><div className="text-[12px] text-[#7a85a8]">Contacts</div><div className="text-[18px] font-bold text-[#0f1b3d]">{contactStats.total.toLocaleString()}</div></div>
        </div>
        <div className="stat-card">
          <span className="w-9 h-9 rounded-full bg-[#e7f8f0] text-[#12b76a] flex items-center justify-center"><UserCheck size={16} /></span>
          <div><div className="text-[12px] text-[#7a85a8]">Subscribed Contacts</div><div className="text-[18px] font-bold text-[#0f1b3d]">{contactStats.subscribed.toLocaleString()}</div></div>
        </div>
        <div className="stat-card">
          <span className="w-9 h-9 rounded-full bg-[#feeeef] text-[#f04438] flex items-center justify-center"><UserX size={16} /></span>
          <div><div className="text-[12px] text-[#7a85a8]">Unsubscribed Contacts</div><div className="text-[18px] font-bold text-[#0f1b3d]">{contactStats.unsubscribed}</div></div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 relative" onClick={(e) => e.stopPropagation()}>
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setFiltersOpen(true)}>
            <Filter size={13} /> Filter
          </button>
          {selected.size > 0 && (
            <div className="relative">
              <button className="btn-secondary flex items-center gap-1.5" onClick={() => setActionsOpen(!actionsOpen)}>
                Actions <ChevronDown size={13} />
              </button>
              {actionsOpen && (
                <div className="absolute left-0 top-[110%] bg-white border border-[#eceef5] rounded-xl shadow-lg w-[210px] py-1.5 z-30">
                  {[
                    { icon: <UserPlus size={14} />, label: "Add to Lists", fn: () => { setActionsOpen(false); setAddOpen(true); } },
                    { icon: <UserMinus size={14} />, label: "Remove From Lists", fn: () => setActionsOpen(false) },
                    { icon: <Download size={14} />, label: "Download", fn: () => setActionsOpen(false) },
                    { icon: <Ban size={14} />, label: "Unsubscribe", fn: () => setActionsOpen(false) },
                    { icon: <Ban size={14} />, label: "Unsubscribe & Delete", fn: () => setActionsOpen(false) },
                    { icon: <Trash2 size={14} />, label: "Delete", fn: () => setActionsOpen(false) },
                  ].map((a) => (
                    <div key={a.label} onClick={a.fn} className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] text-[#44507a] hover:bg-[#f6f7fb] cursor-pointer">
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
            <input className="input pr-8 w-[220px]" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
          </div>
          <button className="btn-primary flex items-center gap-1.5"><UserPlus size={14} /> Create Contact <ChevronDown size={12} /></button>
        </div>
      </div>

      <div className="bg-white border border-[#eceef5] rounded-xl overflow-hidden">
        {selected.size === visible.length && visible.length > 0 && (
          <div className="px-5 py-2 bg-[#eef1fe] text-[12px] text-[#3b4ef5] text-center">
            All {visible.length} contacts on this page are selected. <span className="font-semibold underline cursor-pointer">Select all {contactStats.total.toLocaleString()} contacts.</span>
          </div>
        )}
        <div className="grid grid-cols-[36px_1fr_1fr_1.1fr_1.2fr_1.2fr_1.3fr] px-5 py-3 text-[11px] font-semibold tracking-wide text-[#7a85a8] bg-[#fafbfe] border-b border-[#eceef5]">
          <input type="checkbox" className="checkbox" checked={selected.size === visible.length && visible.length > 0} onChange={toggleAll} />
          <span>FIRST NAME</span><span>LAST NAME</span><span>MOBILE NUMBER</span><span>EMAIL</span><span>OPT-IN STATUS</span><span>CREATED</span>
        </div>
        {visible.map((c) => (
          <div key={c.id} className={`row-hover grid grid-cols-[36px_1fr_1fr_1.1fr_1.2fr_1.2fr_1.3fr] items-center px-5 py-3 border-b border-[#f1f3f9] last:border-0 ${selected.has(c.id) ? "bg-[#fafbff]" : ""}`}>
            <input type="checkbox" className="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            <span className="text-[13px] text-[#0f1b3d]">{c.firstName}</span>
            <span className="text-[13px] text-[#0f1b3d]">{c.lastName}</span>
            <span className="text-[13px] text-[#44507a]">{c.mobile}</span>
            <span className="text-[13px] text-[#44507a]">{c.email}</span>
            <span>
              <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${c.optIn === "Subscribed" ? "bg-[#e7f8f0] text-[#12b76a]" : "bg-[#f1f2f6] text-[#7a85a8]"}`}>
                {c.optIn}
              </span>
            </span>
            <span className="text-[12.5px] text-[#7a85a8]">{c.created}</span>
          </div>
        ))}
      </div>

      {filtersOpen && (
        <div className="modal-overlay" onClick={() => setFiltersOpen(false)}>
          <div className="modal-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1b3d]"><Filter size={15} className="text-[#3b4ef5]" /> Contact Filters</h3>
              <X size={16} className="text-[#9aa3c0] cursor-pointer" onClick={() => setFiltersOpen(false)} />
            </div>
            {["Audience", "Source", "Opt-In Status"].map((f) => (
              <div key={f} className="mb-4">
                <label className="block text-[12px] font-semibold text-[#0f1b3d] mb-1.5">{f}</label>
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
              <X size={16} className="text-[#9aa3c0] cursor-pointer" onClick={() => setAddOpen(false)} />
            </div>
            <p className="text-[12px] text-[#7a85a8] mb-4">Select up to 5 lists to add your selected contacts to.</p>
            <div className="relative mb-3">
              <input className="input pr-8" placeholder="Search" value={listSearch} onChange={(e) => setListSearch(e.target.value)} />
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            </div>
            <div className="border border-[#eceef5] rounded-lg divide-y divide-[#f1f3f9] mb-5">
              {filteredLists.map((l) => (
                <label key={l.id} className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-[#fafbfe]">
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
