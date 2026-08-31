"use client";
import React from "react";
import { Inbox as InboxIcon, Tag as TagIcon, ChevronRight } from "lucide-react";

export default function InboxSettings({ onBack, onOpenTags }:{ onBack: ()=>void; onOpenTags: ()=>void }) {
  const cards = [
    { icon: <InboxIcon size={16} color="#14b8a6" />, title: "General Inbox Settings", desc: "Manage general inbox rules and behaviors.", onClick: undefined as (()=>void) | undefined },
    { icon: <TagIcon size={16} color="#14b8a6" />, title: "Inbox Tags", desc: "Create and manage your inbox tags.", onClick: onOpenTags },
  ];
  return (
    <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: 32, background: "#fbfcfd" }}>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ cursor: "pointer" }} onClick={onBack}>Settings</span><ChevronRight size={11} /> <span style={{ color: "#111827" }}>Inbox</span>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Inbox Settings</h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 24px" }}>Manage your inbox settings, tags, and rules.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, maxWidth: 640 }}>
        {cards.map((c) => (
          <div key={c.title} onClick={c.onClick}
            style={{ background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 10, padding: "18px", cursor: c.onClick ? "pointer" : "default", transition: "box-shadow .12s" }}
            onMouseEnter={(e) => { if (c.onClick) e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,.08)"; }}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: "#ccfbf1", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{c.icon}</span>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
