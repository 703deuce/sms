"use client";

import { useState } from "react";
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

export default function KeywordsList({ onCreate }: { onCreate: () => void }) {
  const [keywords, setKeywords] = useState<Keyword[]>(initialKeywords);
  const [query, setQuery] = useState("");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = keywords.filter(
    (k) =>
      k.name.toLowerCase().includes(query.toLowerCase()) ||
      k.description.toLowerCase().includes(query.toLowerCase())
  );

  const menuAction = (action: string, id: string) => {
    if (action === "Delete") setKeywords((ks) => ks.filter((k) => k.id !== id));
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
      <div style={{ fontSize: 12.5, color: "#8a8fa8", marginBottom: 6 }}>
        Grow <span style={{ margin: "0 4px" }}>/</span> Keywords
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "#eef0fd",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <MessageSquareText size={20} color="#4f46e5" />
          </div>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0, color: "#1f2440" }}>Keywords</h1>
            <p style={{ fontSize: 13, color: "#6a708c", margin: "3px 0 0" }}>
              View and manage all of your keywords.
            </p>
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
              style={{ paddingLeft: 33, width: 220 }}
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
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "260px 1fr 190px 120px 44px",
            padding: "11px 24px",
            borderBottom: "1px solid #eef0f7",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: "#8a8fa8",
          }}
        >
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
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: "#eef0fd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <List size={12} color="#4f46e5" />
              </span>
              <strong style={{ color: "#1f2440" }}>{k.connectedLists}</strong> Connected List
            </div>
            <div>
              <span className="kw-status-pill">{k.status}</span>
            </div>
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(openMenu === k.id ? null : k.id);
                }}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 6,
                  borderRadius: 6,
                  display: "flex",
                  color: "#8a8fa8",
                }}
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
                  <div style={{ height: 1, background: "#eef0f7", margin: "4px 6px" }} />
                  <button className="danger" onClick={() => menuAction("Delete", k.id)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#8a8fa8", fontSize: 13.5 }}>
            No keywords found.
          </div>
        )}

        <div style={{ padding: "12px 24px", borderTop: "1px solid #eef0f7" }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: "1px solid #dfe2ee",
              background: "#fff",
              borderRadius: 8,
              padding: "7px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#4a5070",
              cursor: "pointer",
            }}
          >
            25 Per Page <ChevronDown size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
