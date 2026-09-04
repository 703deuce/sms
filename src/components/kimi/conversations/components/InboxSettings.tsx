"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Inbox as InboxIcon, Tag as TagIcon, ChevronRight } from "lucide-react";

export default function InboxSettings({ onBack, onOpenTags, onOpenMessagingSettings }:{
  onBack: ()=>void; onOpenTags: ()=>void; onOpenMessagingSettings?: ()=>void;
}) {
  const router = useRouter();
  const cards = [
    {
      icon: <InboxIcon size={16} />,
      tint: "var(--tv-primary-soft)",
      color: "var(--tv-primary)",
      title: "General Inbox Settings",
      desc: "Manage general inbox rules and behaviors.",
      onClick: onOpenMessagingSettings ?? (() => router.push("/settings/messaging")),
    },
    {
      icon: <TagIcon size={16} />,
      tint: "var(--tv-primary-soft)",
      color: "var(--tv-primary)",
      title: "Inbox Tags",
      desc: "Create and manage your inbox tags.",
      onClick: onOpenTags,
    },
  ];
  return (
    <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: "32px 36px", background: "var(--tv-panel)" }}>
      <div style={{ fontSize: 12, color: "var(--tv-faint)", marginBottom: 10, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ cursor: "pointer", fontWeight: 500 }} onClick={onBack}>Settings</span>
        <ChevronRight size={11} />
        <span style={{ color: "var(--tv-text)", fontWeight: 500 }}>Inbox</span>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, color: "var(--tv-text)", margin: 0 }}>Inbox Settings</h2>
      <p style={{ fontSize: 13, color: "var(--tv-muted)", margin: "6px 0 26px" }}>Manage your inbox settings, tags, and rules.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14, maxWidth: 640 }}>
        {cards.map((c) => (
          <div key={c.title} onClick={c.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") c.onClick(); }}
            style={{
              background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 12, padding: "18px",
              cursor: "pointer",
              transition: "box-shadow .15s, border-color .15s, transform .15s",
              boxShadow: "0 1px 2px rgba(16,24,40,.04)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 8px 20px rgba(16,24,40,.09)"; e.currentTarget.style.borderColor = "#d3d8e0"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,.04)"; e.currentTarget.style.borderColor = "var(--tv-border)"; e.currentTarget.style.transform = "none"; }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: c.tint, color: c.color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{c.icon}</span>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 12, letterSpacing: -0.1, color: "var(--tv-text)", display: "flex", alignItems: "center", gap: 4 }}>
              {c.title}
              <ChevronRight size={13} style={{ color: "#c3c9d2" }} />
            </div>
            <div style={{ fontSize: 12.5, color: "var(--tv-muted)", marginTop: 5, lineHeight: 1.55 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
