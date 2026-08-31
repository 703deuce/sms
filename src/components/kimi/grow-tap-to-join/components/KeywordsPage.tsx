"use client";

import { useState } from "react";
import { Search, Plus, MoreVertical, ListChecks, Pencil, Copy, QrCode, MousePointerClick, Trash2 } from "lucide-react";
import { Keyword } from "../mock-data";

interface Props {
  keywords: Keyword[];
  onCreateTapLink: (keyword: string) => void;
}

export default function KeywordsPage({ keywords, onCreateTapLink }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

      <div className="ttj-table">
        <div className="ttj-table-head ttj-kw-grid">
          <span>KEYWORD</span><span>DESCRIPTION</span><span>STATUS</span><span />
        </div>
        {filtered.map((kw) => (
          <div key={kw.id} className="ttj-table-row ttj-kw-grid">
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
            <div className="ttj-row-actions">
              <button
                className="ttj-icon-btn"
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
                  <button className="ttj-menu-item danger"><Trash2 size={13} /> Delete</button>
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
