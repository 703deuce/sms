"use client";
import { useState } from "react";
import { MessageSquareText, Search, ArrowUpDown, ArrowUp, ArrowDown, Pencil, Wrench, List, UserPlus } from "lucide-react";
import { Keyword } from "../mock-data";

interface Props {
  keywords: Keyword[];
  onEditKeyword: (k: Keyword) => void;
  onCreateKeyword: () => void;
}

export default function ToolsPage({ keywords, onEditKeyword, onCreateKeyword }: Props) {
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);

  const filtered = keywords.filter((k) => k.keyword.toLowerCase().includes(search.toLowerCase()));
  const visible = !sortDir
    ? filtered
    : [...filtered].sort((a, b) => (sortDir === "asc" ? a.keyword.localeCompare(b.keyword) : b.keyword.localeCompare(a.keyword)));

  const toggleSort = () => setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
  const SortIcon = sortDir === "asc" ? ArrowUp : sortDir === "desc" ? ArrowDown : ArrowUpDown;

  return (
    <div>
      <div className="flex items-start justify-between mb-6 toolbar-stack gap-3">
        <div>
          <h1 className="page-title"><Wrench size={19} className="text-[#3b4ef5]" /> Tools</h1>
          <p className="page-subtitle">Keywords let contacts join your lists by texting a word to your number.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa3c0]" />
            <input className="input pl-8 w-[220px]" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search keywords" />
          </div>
          <button className="btn-primary" onClick={onCreateKeyword}><MessageSquareText size={14} /> Create Keyword</button>
        </div>
      </div>

      <div className="table-card">
        <div className="table-head grid grid-cols-[1fr_1.6fr_170px_150px_140px_40px]">
          <button
            className="flex items-center gap-1 cursor-pointer hover:text-[#44507a] bg-transparent border-0 p-0 text-inherit"
            onClick={toggleSort}
            aria-label={`Sort by keyword ${sortDir === "asc" ? "descending" : "ascending"}`}
          >
            KEYWORD <SortIcon size={11} />
          </button>
          <span className="hide-sm">DESCRIPTION</span>
          <span className="hide-md">LAST SAVED</span>
          <span>LISTS</span>
          <span>STATUS</span>
          <span></span>
        </div>
        {visible.map((k) => (
          <div key={k.id} className="table-row grid grid-cols-[1fr_1.6fr_170px_150px_140px_40px] hover:bg-[#fafbfe]">
            <div>
              <button className="cell-primary hover:text-[#3b4ef5] hover:underline bg-transparent border-0 p-0 cursor-pointer" onClick={() => onEditKeyword(k)}>
                {k.keyword}
              </button>
            </div>
            <div className="cell-body hide-sm">{k.description}</div>
            <div className="cell-sub hide-md">{k.lastSaved}</div>
            <div className="flex items-center gap-1.5 text-[12.5px] text-[#7a85a8]">
              <List size={13} className="text-[#9aa3c0]" /> {k.connectedLists} list{k.connectedLists === 1 ? "" : "s"}
            </div>
            <div>
              <span className={`chip ${k.status === "Inactive" ? "chip-gray" : "chip-green"}`}>{k.status ?? "Active"}</span>
            </div>
            <div>
              <button className="flex h-7 w-7 items-center justify-center rounded-md text-[#9aa3c0] hover:bg-[#eef1fe] hover:text-[#3b4ef5]" onClick={() => onEditKeyword(k)} aria-label={`Edit keyword ${k.keyword}`}>
                <Pencil size={14} />
              </button>
            </div>
          </div>
        ))}
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center px-5 py-14 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef1fe] text-[#3b4ef5]"><MessageSquareText size={18} /></span>
            <div className="text-[13px] font-semibold text-[#0f1b3d]">No keywords found</div>
            <div className="mt-1 text-[12.5px] text-[#7a85a8]">No keywords match your search. Try a different term.</div>
          </div>
        )}
        <div className="table-footer">
          <span className="text-[12px] text-[#9aa3c0] flex items-center gap-1.5"><UserPlus size={12} /> Keywords create subscribed contacts when texted.</span>
          <span className="text-[12px] text-[#9aa3c0]">{visible.length} keyword{visible.length === 1 ? "" : "s"}</span>
        </div>
      </div>
    </div>
  );
}
