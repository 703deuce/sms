"use client";
import React from "react";
import { SlidersHorizontal, BadgeCheck, ListChecks, Puzzle, Code2, PhoneOutgoing, Inbox as InboxIcon, ShoppingCart, Link2, BarChart2, ShieldCheck, FileCode2 } from "lucide-react";

const CARDS = [
  { icon: <SlidersHorizontal size={16} />, tint: "#eef2ff", color: "#4f46e5", title: "General", desc: "Manage basic settings and default messaging." },
  { icon: <BadgeCheck size={16} />, tint: "#ecfeff", color: "#0891b2", title: "Brand Info", desc: "Manage your brand's info and contact information." },
  { icon: <ListChecks size={16} />, tint: "#f5f3ff", color: "#7c3aed", title: "Custom Fields", desc: "Create and manage custom contact fields." },
  { icon: <Puzzle size={16} />, tint: "#fff7ed", color: "#ea580c", title: "Integrations", desc: "View and manage your existing integrations." },
  { icon: <Code2 size={16} />, tint: "#f0fdf4", color: "#16a34a", title: "API & Webhooks", desc: "Manage your API keys and webhook settings." },
  { icon: <PhoneOutgoing size={16} />, tint: "#eff6ff", color: "#2563eb", title: "Sending Numbers", desc: "View your sending numbers and number options." },
  { icon: <InboxIcon size={16} />, tint: "#eef2ff", color: "#4f46e5", title: "Inbox", desc: "Manage your inbox settings, tags, and rules.", go: "inboxSettings" },
  { icon: <ShoppingCart size={16} />, tint: "#fdf2f8", color: "#db2777", title: "Ecommerce", desc: "Manage your abandoned cart and revenue attribution settings." },
  { icon: <Link2 size={16} />, tint: "#f0fdfa", color: "#0d9488", title: "Link Domains", desc: "View and manage the domains used for your links." },
  { icon: <BarChart2 size={16} />, tint: "#fffbeb", color: "#d97706", title: "UTM Parameters", desc: "View and manage your link's UTM settings." },
  { icon: <ShieldCheck size={16} />, tint: "#f0fdf4", color: "#059669", title: "Compliance", desc: "Manage all things related to TCPA compliance." },
  { icon: <FileCode2 size={16} />, tint: "#f1f5f9", color: "#475569", title: "Transovo Tag", desc: "Access the code snippet that powers Transovo-related features on your website." },
];

export default function SettingsHome({ onOpenInbox }:{ onOpenInbox: ()=>void }) {
  return (
    <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: 32, background: "#fbfcfd" }}>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Settings</div>
      <h2 style={{ fontSize: 22, fontWeight: 700 }}>Settings</h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 24px" }}>Manage functional settings for your brand / account.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14, maxWidth: 980 }}>
        {CARDS.map((c) => (
          <div key={c.title} onClick={c.go ? onOpenInbox : undefined}
            style={{ background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 10, padding: "18px 18px 16px", cursor: c.go ? "pointer" : "default", transition: "box-shadow .12s" }}
            onMouseEnter={(e) => { if (c.go) e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,.08)"; }}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "")}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: c.tint, display: "inline-flex", alignItems: "center", justifyContent: "center", color: c.color }}>{c.icon}</span>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 10 }}>{c.title}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
