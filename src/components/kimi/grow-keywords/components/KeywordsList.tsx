"use client";

import { useEffect, useState } from "react";
import {
  Search,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Copy,
  QrCode,
  MousePointerClick,
  Trash2,
  List,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react";
import { keywords as initialKeywords, Keyword } from "../mock-data";

export default function KeywordsList({
  keywords: keywordsProp,
  onCreate,
  onDelete,
}: {
  keywords?: Keyword[];
  onCreate: () => void;
  onDelete?: (id: string) => void;
}) {
  const [keywords, setKeywords] = useState<Keyword[]>(keywordsProp ?? initialKeywords);
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (keywordsProp) setKeywords(keywordsProp);
  }, [keywordsProp]);

  const filtered = keywords.filter(
    (k) =>
      k.name.toLowerCase().includes(query.toLowerCase()) ||
      k.description.toLowerCase().includes(query.toLowerCase())
  );

  const menuAction = (action: string, id: string) => {
    if (action === "Delete") {
      setKeywords((ks) => ks.filter((k) => k.id !== id));
      onDelete?.(id);
    }
    if (action === "Clone") {
      const src = keywords.find((k) => k.id === id);
      if (src)
        setKeywords((ks) => [
          { ...src, id: `${src.id}-copy-${Date.now()}`, name: `${src.name}Copy` },
          ...ks,
        ]);
    }
    setOpenMenu(null);
  };

  return (
    <div className="kw-fade" onClick={() => openMenu && setOpenMenu(null)}>
      {/* Breadcrumb */}
      <div className="kw-breadcrumb">
        Grow <span className="kw-breadcrumb-sep">/</span>{" "}
        <span className="kw-breadcrumb-current">Keywords</span>
      </div>

      {/* Header */}
      <div className="kw-page-header">
        <div style={{ display: "flex", gap: 12 }}>
          <div className="kw-header-icon">
            <MessageSquareText size={20} color="#4f46e5" />
          </div>
          <div>
            <h1 className="kw-page-title">Keywords</h1>
            <p className="kw-page-subtitle">View and manage all of your keywords.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search
              size={15}
              color="#a3a8c0"
              style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }}
            />
            <input
              className="kw-input"
              style={{ paddingLeft: 33, width: 220, height: 38 }}
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="kw-btn-primary" onClick={onCreate}>
            Create Keyword
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="kw-card" style={{ overflow: "visible" }}>
        <div className="kw-table-head">
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            Keyword <ArrowUpDown size={11} />
          </span>
          <span>Description</span>
          <span />
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            Status <ArrowUpDown size={11} />
          </span>
          <span />
        </div>

        {filtered.map((k) => (
          <div key={k.id} className="kw-row">
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#1f2440" }}>{k.name}</div>
              <div style={{ fontSize: 11.5, color: "#8a8fa8", marginTop: 2 }}>{k.lastSaved}</div>
            </div>
            <div style={{ fontSize: 13, color: "#4a5070", paddingRight: 24 }}>{k.description}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "#4a5070" }}>
              <span className="kw-list-icon">
                <List size={12} color="#4f46e5" />
              </span>
              <strong style={{ color: "#1f2440", fontWeight: 700 }}>{k.connectedLists}</strong> Connected List
            </div>
            <div>
              <span className="kw-status-pill">
                <span className="kw-status-dot" />
                {k.status}
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <button
                className="kw-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === k.id ? null : k.id);
                }}
                aria-label="Keyword actions"
              >
                <MoreVertical size={16} />
              </button>
              {openMenu === k.id && (
                <div className="kw-dropdown kw-fade" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => menuAction("Edit", k.id)}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={() => menuAction("Clone", k.id)}>
                    <Copy size={14} /> Clone
                  </button>
                  <button onClick={() => menuAction("QR", k.id)}>
                    <QrCode size={14} /> Create QR Code
                  </button>
                  <button onClick={() => menuAction("Tap", k.id)}>
                    <MousePointerClick size={14} /> Create Tap-to-Join Link
                  </button>
                  <div className="kw-dropdown-divider" />
                  <button className="danger" onClick={() => menuAction("Delete", k.id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="kw-empty">
            <div className="kw-header-icon" style={{ margin: "0 auto 12px" }}>
              <MessageSquareText size={20} color="#4f46e5" />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1f2440" }}>No keywords found</div>
            <div style={{ fontSize: 13, color: "#8a8fa8", marginTop: 4 }}>
              {query ? "Try a different search term." : "Create your first keyword to get started."}
            </div>
            {!query && (
              <button className="kw-btn-primary" style={{ marginTop: 16 }} onClick={onCreate}>
                Create Keyword
              </button>
            )}
          </div>
        )}

        <div style={{ padding: "12px 20px", borderTop: "1px solid #eef0f7" }}>
          <button className="kw-btn-outline">
            25 Per Page <ChevronDown size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
