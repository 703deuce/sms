"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Plus, MoreVertical, MousePointerClick, Pencil, Copy, ExternalLink, Link2, Trash2, Info } from "lucide-react";
import { TapLink } from "../mock-data";

interface Props {
  links: TapLink[];
  onCreate: () => void;
  onEdit: (link: TapLink) => void;
  onDelete: (id: string) => void;
  onClone: (link: TapLink) => void;
}

export default function LinksListPage({ links, onCreate, onEdit, onDelete, onClone }: Props) {
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

  const filtered = links.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="ttj-page">
      <div className="ttj-breadcrumb">Tools / <span>Tap-to-Join Links</span></div>
      <div className="ttj-page-header">
        <div className="ttj-page-title-row">
          <div className="ttj-page-icon"><MousePointerClick size={20} /></div>
          <div>
            <h1>Tap-to-Join Links</h1>
            <p>Manage the Tap-to-Join links you&apos;ve created.</p>
          </div>
        </div>
        <div className="ttj-header-actions">
          <div className="ttj-search">
            <Search size={14} />
            <input placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="ttj-btn-primary" onClick={onCreate}><Plus size={14} /> Create Link</button>
        </div>
      </div>

      <div className="ttj-table overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="ttj-table-head ttj-link-grid border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Name</span><span /><span>Status</span><span />
        </div>
        {filtered.map((link) => (
          <div key={link.id} className="ttj-table-row ttj-link-grid border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/30">
            <div className="ttj-cell-main">
              <span className="ttj-cell-title">
                {link.name}
                <Pencil size={11} className="ttj-inline-edit opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="ttj-cell-sub">{link.createdAt}</span>
            </div>
            <div className="ttj-cell-stats">
              <Info size={13} className="ttj-info-icon" />
              <div className="ttj-stat"><strong>{link.all}</strong><span>All</span></div>
              <div className="ttj-stat"><strong>{link.unique}</strong><span>Unique</span></div>
              <div className="ttj-stat"><strong>{link.bot}</strong><span>Bot</span></div>
            </div>
            <div>
              <span className={`ttj-status ${link.status.toLowerCase()}`}>{link.status}</span>
            </div>
            <div className="ttj-row-actions" ref={openMenu === link.id ? menuRef : null}>
              <button
                className="ttj-icon-btn"
                aria-label="Link actions"
                onClick={() => setOpenMenu(openMenu === link.id ? null : link.id)}
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === link.id && (
                <div className="ttj-menu">
                  <button className="ttj-menu-item" onClick={() => { onEdit(link); setOpenMenu(null); }}><Pencil size={13} /> Edit</button>
                  <button className="ttj-menu-item" onClick={() => { onClone(link); setOpenMenu(null); }}><Copy size={13} /> Clone</button>
                  <button
                    className="ttj-menu-item"
                    onClick={() => {
                      if (link.url) window.open(link.url, "_blank", "noopener,noreferrer");
                      setOpenMenu(null);
                    }}
                  >
                    <ExternalLink size={13} /> Open Url
                  </button>
                  <button className="ttj-menu-item" onClick={() => { navigator.clipboard?.writeText(link.url); setOpenMenu(null); }}><Link2 size={13} /> Copy Url</button>
                  <div className="my-1 border-t border-border/60" />
                  <button className="ttj-menu-item danger" onClick={() => { onDelete(link.id); setOpenMenu(null); }}><Trash2 size={13} /> Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <MousePointerClick size={20} />
            </div>
            <p className="text-sm font-semibold text-foreground">
              {search ? "No links match your search" : "No Tap-to-Join links yet"}
            </p>
            <p className="mt-1 max-w-xs text-[13px] text-muted-foreground">
              {search
                ? "Try a different name or clear the search."
                : "Create your first link to let people join your list with a single tap."}
            </p>
            {!search && (
              <button className="ttj-btn-primary mt-4" onClick={onCreate}><Plus size={14} /> Create Link</button>
            )}
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
