"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Plus, MoreVertical, ListChecks, Pencil, Copy, QrCode, MousePointerClick, Trash2 } from "lucide-react";
import { Keyword } from "../mock-data";

interface Props {
  keywords: Keyword[];
  onCreateTapLink: (keyword: string) => void;
}

export default function KeywordsPage({ keywords, onCreateTapLink }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  const filtered = keywords.filter((k) =>
    k.keyword.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="ttj-page">
      <div className="ttj-breadcrumb">Tools / <span>Keywords</span></div>
      <div className="ttj-page-header">
        <div className="ttj-page-title-row">
          <div className="ttj-page-icon"><ListChecks size={20} /></div>
          <div>
            <h1>Keywords</h1>
            <p>View and manage all of your keywords.</p>
          </div>
        </div>
        <div className="ttj-header-actions">
          <div className="ttj-search">
            <Search size={14} />
            <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="ttj-btn-primary"><Plus size={14} /> Create Keyword</button>
        </div>
      </div>

      <div className="ttj-table overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="ttj-table-head ttj-kw-grid border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Keyword</span><span>Description</span><span>Status</span><span />
        </div>
        {filtered.map((kw) => (
          <div key={kw.id} className="ttj-table-row ttj-kw-grid border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/30">
            <div className="ttj-cell-main">
              <span className="ttj-cell-title">{kw.keyword}</span>
              <span className="ttj-cell-sub">{kw.lastSaved}</span>
            </div>
            <div className="ttj-cell-desc">
              <button className="ttj-link-btn">Add Description <Pencil size={11} /></button>
              <div className="ttj-connected"><ListChecks size={13} /> {kw.connectedLists} Connected List{kw.connectedLists !== 1 ? "s" : ""}</div>
            </div>
            <div>
              <span className={`ttj-status ${kw.status.toLowerCase()}`}>{kw.status}</span>
            </div>
            <div className="ttj-row-actions" ref={openMenu === kw.id ? menuRef : null}>
              <button
                className="ttj-icon-btn"
                aria-label="Keyword actions"
                onClick={() => setOpenMenu(openMenu === kw.id ? null : kw.id)}
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === kw.id && (
                <div className="ttj-menu">
                  <button className="ttj-menu-item"><Pencil size={13} /> Edit</button>
                  <button className="ttj-menu-item"><Copy size={13} /> Clone</button>
                  <button className="ttj-menu-item"><QrCode size={13} /> Create QR Code</button>
                  <button
                    className="ttj-menu-item"
                    onClick={() => { setOpenMenu(null); onCreateTapLink(kw.keyword); }}
                  >
                    <MousePointerClick size={13} /> Create Tap-to-Join Link
                  </button>
                  <div className="my-1 border-t border-border/60" />
                  <button className="ttj-menu-item danger"><Trash2 size={13} /> Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ListChecks size={20} />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {search ? "No keywords match your search" : "No keywords yet"}
            </p>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
              {search ? "Try a different search term." : "Create a keyword to start growing your list."}
            </p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="ttj-table-foot border-t border-border/60 bg-muted/20">
            <select className="ttj-select-sm"><option>25 Per Page</option><option>50 Per Page</option></select>
          </div>
        )}
      </div>
    </div>
  );
}
