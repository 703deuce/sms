"use client";
import { Search, Users, ListPlus, ArrowUpDown, MoreVertical } from "lucide-react";
import { ContactList } from "../mock-data";

interface Props {
  lists: ContactList[];
  onCreate: () => void;
}

export default function ListsPage({ lists, onCreate }: Props) {
  return (
    <div className="p-8 max-w-[1100px]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="flex items-center gap-2 text-[20px] font-bold text-[#0f1b3d]">
            <Users size={20} className="text-[#3b4ef5]" /> Lists
          </h1>
          <p className="text-[13px] text-[#7a85a8] mt-0.5">View and manage all of your contact lists.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input className="input pr-8 w-[220px]" placeholder="Search" />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
          </div>
          <button className="btn-primary flex items-center gap-1.5" onClick={onCreate}>
            <ListPlus size={14} /> Create List
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#eceef5] rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1.1fr_1.3fr_180px_40px] px-5 py-3 text-[11px] font-semibold tracking-wide text-[#7a85a8] bg-[#fafbfe] border-b border-[#eceef5]">
          <span className="flex items-center gap-1">NAME <ArrowUpDown size={11} /></span>
          <span>DESCRIPTION</span>
          <span></span>
          <span></span>
        </div>
        {lists.map((l) => (
          <div key={l.id} className="row-hover grid grid-cols-[1.1fr_1.3fr_180px_40px] items-center px-5 py-3.5 border-b border-[#f1f3f9] last:border-0">
            <div>
              <div className="text-[13.5px] font-semibold text-[#0f1b3d]">{l.name}</div>
              <div className="text-[11.5px] text-[#9aa3c0]">Created on {l.created}</div>
            </div>
            <div className="text-[13px] text-[#44507a]">{l.description}</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="w-7 h-7 rounded-full bg-[#eef1fe] text-[#3b4ef5] flex items-center justify-center"><Users size={13} /></span>
              <span className="text-[13px] font-semibold text-[#0f1b3d]">{l.contacts.toLocaleString()}</span>
              <span className="text-[11px] text-[#9aa3c0]">Contacts</span>
            </div>
            <MoreVertical size={15} className="text-[#9aa3c0] cursor-pointer" />
          </div>
        ))}
        <div className="px-5 py-3">
          <select className="input w-auto text-[12px] py-1.5">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
        </div>
      </div>
    </div>
  );
}
