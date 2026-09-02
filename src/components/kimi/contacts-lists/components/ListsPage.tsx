"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Users, ListPlus, ArrowUpDown, MoreVertical, ListX, Trash2 } from "lucide-react";
import { ContactList } from "../mock-data";

interface Props {
  lists: ContactList[];
  onCreate: () => void;
  onDelete?: (id: string) => void | Promise<void>;
}

export default function ListsPage({ lists, onCreate, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const visible = lists.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenu]);

  const handleDelete = (list: ContactList) => {
    if (!onDelete) return;
    if (!window.confirm(`Delete list "${list.name}"? Contacts will not be deleted.`)) return;
    void Promise.resolve(onDelete(list.id)).then(() => setOpenMenu(null));
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title"><Users size={19} className="text-[#3b4ef5]" /> Lists</h1>
          <p className="page-subtitle">View and manage all of your contact lists.</p>
        </div>
        <div className="flex items-center gap-2.5">
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
          <span className="flex items-center gap-1 cursor-pointer transition-colors hover:text-[#44507a]">NAME <ArrowUpDown size={11} /></span>
          <span>DESCRIPTION</span>
          <span className="text-right">CONTACTS</span>
          <span></span>
        </div>
        {visible.map((l) => (
          <div key={l.id} className="table-row grid grid-cols-[1.1fr_1.3fr_190px_40px] transition-colors hover:bg-[#fafbfe]">
            <div>
              <div className="cell-primary">{l.name}</div>
              <div className="cell-sub">Created on {l.created}</div>
            </div>
            <div className="cell-body">{l.description}</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef1fe] text-[#3b4ef5]"><Users size={13} /></span>
              <span className="text-[13px] font-semibold tabular-nums text-[#0f1b3d]">{l.contacts.toLocaleString()}</span>
              <span className="text-[11px] text-[#9aa3c0]">Contacts</span>
            </div>
            <div className="relative" ref={openMenu === l.id ? menuRef : null}>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#9aa3c0] transition-colors hover:bg-[#eef1fe] hover:text-[#3b4ef5]"
                onClick={() => setOpenMenu(openMenu === l.id ? null : l.id)}
                aria-label="List actions"
              >
                <MoreVertical size={15} />
              </button>
              {openMenu === l.id && onDelete && (
                <div className="menu-pop right-0 mt-1 w-40">
                  <button className="menu-item w-full text-[#f04438] hover:bg-[#feeeef]" onClick={() => handleDelete(l)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef1fe] text-[#3b4ef5]"><ListX size={18} /></span>
            <div className="text-[13px] font-semibold text-[#0f1b3d]">No lists found</div>
            <div className="mt-1 text-[12.5px] text-[#7a85a8]">No lists match your search. Try a different term.</div>
          </div>
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
