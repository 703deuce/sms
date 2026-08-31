"use client";
import { useState } from "react";
import { Search, Users, ListPlus, ArrowUpDown, MoreVertical } from "lucide-react";
import { ContactList } from "../mock-data";

interface Props {
  lists: ContactList[];
  onCreate: () => void;
}

export default function ListsPage({ lists, onCreate }: Props) {
  const [search, setSearch] = useState("");
  const visible = lists.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title"><Users size={19} className="text-[#3b4ef5]" /> Lists</h1>
          <p className="page-subtitle">View and manage all of your contact lists.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            <input
              className="input pl-8 w-[220px]"
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={onCreate}>
            <ListPlus size={14} /> Create List
          </button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-head grid grid-cols-[1.1fr_1.3fr_190px_40px]">
          <span className="flex items-center gap-1 cursor-pointer hover:text-[#44507a]">NAME <ArrowUpDown size={11} /></span>
          <span>DESCRIPTION</span>
          <span className="text-right">CONTACTS</span>
          <span></span>
        </div>
        {visible.map((l) => (
          <div key={l.id} className="table-row grid grid-cols-[1.1fr_1.3fr_190px_40px]">
            <div>
              <div className="cell-primary">{l.name}</div>
              <div className="cell-sub">Created on {l.created}</div>
            </div>
            <div className="cell-body">{l.description}</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="w-7 h-7 rounded-full bg-[#eef1fe] text-[#3b4ef5] flex items-center justify-center"><Users size={13} /></span>
              <span className="text-[13px] font-semibold text-[#0f1b3d] tabular-nums">{l.contacts.toLocaleString()}</span>
              <span className="text-[11px] text-[#9aa3c0]">Contacts</span>
            </div>
            <MoreVertical size={15} className="text-[#9aa3c0] cursor-pointer hover:text-[#44507a]" />
          </div>
        ))}
        {visible.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-[#7a85a8]">No lists match your search.</div>
        )}
        <div className="table-footer">
          <select className="input w-auto text-[12px] py-1.5">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
          <span className="text-[12px] text-[#9aa3c0]">{visible.length} list{visible.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
