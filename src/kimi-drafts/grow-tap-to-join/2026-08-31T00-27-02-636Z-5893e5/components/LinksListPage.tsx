"use client";

import { useState } from "react";
import { Search, Plus, MoreVertical, MousePointerClick, Pencil, Copy, ExternalLink, Link2, Trash2, Info } from "lucide-react";
import { TapLink } from "../mock-data";

interface Props {
  links: TapLink[];
  onCreate: () => void;
  onDelete: (id: string) => void;
  onClone: (link: TapLink) => void;
  onOpenFallback: () => void;
}

export default function LinksListPage({ links, onCreate, onDelete, onClone, onOpenFallback }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = links.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="ttj-page">
      <div className="ttj-breadcrumb">Tools / <span>Tap-to-Join Links</span></div>
      <div className="ttj-page-header">
        <div className="ttj-page-title-row">
          <div className="ttj-page-icon"><MousePointerClick size={20} /></div>
          <div>
            <h1>Tap-to-Join Links</h1>
            <p>Manage the Tap-to-Join links you've created.</p>
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

      <div className="ttj-table">
        <div className="ttj-table-head ttj-link-grid">
          <span>NAME</span><span /><span>STATUS</span><span />
        </div>
        {filtered.map((link) => (
          <div key={link.id} className="ttj-table-row ttj-link-grid">
            <div className="ttj-cell-main">
              <span className="ttj-cell-title">{link.name} <Pencil size={11} className="ttj-inline-edit" /></span>
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
            <div className="ttj-row-actions">
              <button
                className="ttj-icon-btn"
                onClick={() => setOpenMenu(openMenu === link.id ? null : link.id)}
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === link.id && (
                <div className="ttj-menu">
                  <button className="ttj-menu-item"><Pencil size={13} /> Edit</button>
                  <button className="ttj-menu-item" onClick={() => { onClone(link); setOpenMenu(null); }}><Copy size={13} /> Clone</button>
                  <button className="ttj-menu-item" onClick={() => { onOpenFallback(); setOpenMenu(null); }}><ExternalLink size={13} /> Open Url</button>
                  <button className="ttj-menu-item" onClick={() => { navigator.clipboard?.writeText(link.url); setOpenMenu(null); }}><Link2 size={13} /> Copy Url</button>
                  <button className="ttj-menu-item danger" onClick={() => { onDelete(link.id); setOpenMenu(null); }}><Trash2 size={13} /> Delete</button>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="ttj-table-foot">
          <select className="ttj-select-sm"><option>25 Per Page</option><option>50 Per Page</option></select>
        </div>
      </div>
    </div>
  );
}
