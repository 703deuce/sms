"use client";
import React from "react";
import { Pencil } from "lucide-react";
import { Conversation } from "../mock-data";

export default function ContactPanel({ convo, onClose }:{ convo: Conversation; onClose: ()=>void }) {
  const fields: [string, string][] = [
    ["First Name", convo.name.split(" ")[0]],
    ["Last Name", convo.name.split(" ").slice(1).join(" ")],
    ["Mobile Number", convo.phone],
    ["Email", convo.email ?? ""],
    ["Address", ""], ["City", ""], ["State / Province", ""], ["Postal Code", ""],
    ["Country", ""], ["Birthdate", ""], ["Timezone", ""], ["Language", ""],
  ];
  return (
    <div className="ref-scroll" style={{ width: 264, borderLeft: "1px solid var(--tv-border)", background: "#fff", overflowY: "auto", flexShrink: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 16px 12px", borderBottom: "1px solid var(--tv-border)" }}>
        <span className="tv-avatar" style={{ width: 44, height: 44, fontSize: 15, background: convo.color }}>{convo.initials}</span>
        <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8 }}>{convo.name}</div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>August 27th, 2024 @ 8:21 pm</div>
        <button className="tv-chip" style={{ marginTop: 8, cursor: "pointer", color: "#059669", borderColor: "#a7f3d0", background: "#ecfdf5" }}>Subscribed ▾</button>
      </div>
      <div style={{ padding: "10px 16px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9ca3af", letterSpacing: 0.6, margin: "6px 0 10px" }}>CONTACT DETAILS</div>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10.5, color: "#9ca3af" }}>{k}</div>
              <div style={{ fontSize: 13, color: v ? "#111827" : "#d1d5db", borderBottom: "1px solid #f3f4f6", paddingBottom: 3 }}>{v || "—"}</div>
            </div>
            <Pencil size={12} color="#d1d5db" style={{ cursor: "pointer" }} />
          </div>
        ))}
        <button className="tv-btn-ghost" onClick={onClose} style={{ width: "100%", justifyContent: "center", marginTop: 4 }}>Close Panel</button>
      </div>
    </div>
  );
}
