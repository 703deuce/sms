"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, ListPlus, ArrowUpDown, ArrowUp, ArrowDown, MoreVertical, ListX, Trash2, Users } from "lucide-react";
import { ContactList } from "../mock-data";

interface Props {
  lists: ContactList[];
  highlightListId?: string | null;
  onCreate: () => void;
  onOpenContacts: (listId: string) => void;
  onDelete: (id: string) => void;
}

export default function ListsPage({ lists, highlightListId, onCreate, onOpenContacts, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(() => {
    const filtered = lists.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));
    if (!sortDir) return filtered;
    return [...filtered].sort((a, b) =>
      sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name),
    );
  }, [lists, search, sortDir]);

  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [openMenu]);

  const toggleSort = () => setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");

  const handleDelete = (list: ContactList) => {
    if (!window.confirm(`Delete list "${list.name}"? Contacts will not be deleted.`)) return;
    onDelete(list.id);
    setOpenMenu(null);
  };

  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 toolbar-stack gap-3">
        <div>
          <h1 className="page-title"><Users size={19} className="text-[#3b4ef5]" /> Lists</h1>
          <p className="page-subtitle">View and manage all of your contact lists.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            <input className="input pl-8 w-[220px]" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search lists" />
          </div>
          <button className="btn-primary" onClick={onCreate}><ListPlus size={14} /> Create List</button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-head grid grid-cols-[1.1fr_1.3fr_190px_40px]">
          <button
            className="flex items-center gap-1 cursor-pointer hover:text-[#44507a] bg-transparent border-0 p-0 text-inherit font-inherit"
            onClick={toggleSort}
            aria-label={`Sort by name ${sortDir === "asc" ? "descending" : "ascending"}`}
          >
            NAME <SortIcon size={11} />
          </button>
          <span className="hide-sm">DESCRIPTION</span>
          <span className="text-right">CONTACTS</span>
          <span></span>
        </div>
        {visible.map((l) => (
          <div
            key={l.id}
            className={`table-row grid grid-cols-[1.1fr_1.3fr_190px_40px] hover:bg-[#fafbfe] ${
              highlightListId === l.id ? "bg-[#eef1fe] ring-1 ring-inset ring-[#3b4ef5]/30" : ""
            }`}
          >
            <div>
              <button className="cell-primary hover:text-[#3b4ef5] hover:underline bg-transparent border-0 p-0 cursor-pointer" onClick={() => onOpenContacts(l.id)}>
                {l.name}
              </button>
              <div className="cell-sub">Created on {l.created}</div>
            </div>
            <div className="cell-body hide-sm">{l.description}</div>
            <div className="flex items-center gap-2 justify-end">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#eef1fe] text-[#3b4ef5]"><Users size={13} /></span>
              <span className="text-[13px] font-semibold tabular-nums text-[#0f1b3d]">{l.contacts.toLocaleString()}</span>
              <span className="text-[11px] text-[#9aa3c0] hide-md">Contacts</span>
            </div>
            <div className="relative" ref={openMenu === l.id ? menuRef : null}>
              <button
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#9aa3c0] hover:bg-[#eef1fe] hover:text-[#3b4ef5]"
                onClick={() => setOpenMenu(openMenu === l.id ? null : l.id)}
                aria-label={`Actions for ${l.name}`}
                aria-expanded={openMenu === l.id}
              >
                <MoreVertical size={15} />
              </button>
              {openMenu === l.id && (
                <div className="menu-pop right-0 mt-1 w-44" role="menu">
                  <button className="menu-item" role="menuitem" onClick={() => { setOpenMenu(null); onOpenContacts(l.id); }}>
                    <Users size={14} /> View contacts
                  </button>
                  <button className="menu-item text-[#f04438] hover:bg-[#feeeef]" role="menuitem" onClick={() => handleDelete(l)}>
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
            <div className="text-[13px] font-semibold text-[#0f1b3d]">{lists.length === 0 ? "No lists yet" : "No lists found"}</div>
            <div className="mt-1 text-[12.5px] text-[#7a85a8]">
              {lists.length === 0 ? "Create your first list to organize contacts for booking and reminders." : "No lists match your search. Try a different term."}
            </div>
            {lists.length === 0 && <button className="btn-primary mt-4" onClick={onCreate}><ListPlus size={14} /> Create List</button>}
          </div>
        )}
        <div className="table-footer">
          <select className="input w-auto text-[12px] py-1.5" aria-label="Rows per page">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
          <span className="text-[12px] text-[#9aa3c0]">{visible.length} list{visible.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
