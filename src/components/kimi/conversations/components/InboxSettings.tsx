"use client";
import React from "react";
import { Inbox as InboxIcon, Tag as TagIcon, ChevronRight } from "lucide-react";

export default function InboxSettings({ onBack, onOpenTags }:{ onBack: ()=>void; onOpenTags: ()=>void }) {
  const cards = [
    { icon: <InboxIcon size={16} color="#14b8a6" />, title: "General Inbox Settings", desc: "Manage general inbox rules and behaviors.", onClick: undefined as (()=>void) | undefined },
    { icon: <TagIcon size={16} color="#14b8a6" />, title: "Inbox Tags", desc: "Create and manage your inbox tags.", onClick: onOpenTags },
  ];
  return (
    <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "32px 36px", background: "#fbfcfd" }}>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ cursor: "pointer", fontWeight: 500 }} onClick={onBack}>Settings</span><ChevronRight size={11} /> <span style={{ color: "#111827", fontWeight: 500 }}>Inbox</span>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: "#111827", margin: 0 }}>Inbox Settings</h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 26px" }}>Manage your inbox settings, tags, and rules.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, maxWidth: 640 }}>
        {cards.map((c) => (
          <div key={c.title} onClick={c.onClick}
            style={{
              background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 12, padding: "18px",
              cursor: c.onClick ? "pointer" : "default",
              transition: "box-shadow .15s, border-color .15s, transform .15s",
              boxShadow: "0 1px 2px rgba(16,24,40,.04)",
            }}
            onMouseEnter={(e) => { if (c.onClick) { e.currentTarget.style.boxShadow = "0 8px 20px rgba(16,24,40,.09)"; e.currentTarget.style.borderColor = "#d3d8e0"; } }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,.04)"; e.currentTarget.style.borderColor = "var(--tv-border)"; }}>
            <span style={{ width: 32, height: 32, borderRadius: 9, background: "#ccfbf1", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{c.icon}</span>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12, letterSpacing: -0.1, color: "#111827" }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 5, lineHeight: 1.55 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
