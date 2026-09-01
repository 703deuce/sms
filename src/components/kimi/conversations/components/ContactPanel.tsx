"use client";
import React from "react";
import { Pencil, X } from "lucide-react";
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
    <div className="ref-scroll" style={{ width: 276, borderLeft: "1px solid var(--tv-border)", background: "#fff", overflowY: "auto", flexShrink: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "22px 16px 16px", borderBottom: "1px solid var(--tv-border)", position: "relative", background: "linear-gradient(180deg, var(--tv-panel) 0%, #fff 100%)" }}>
        <button className="tv-icon-btn" onClick={onClose} title="Close panel" style={{ position: "absolute", top: 10, right: 10, width: 26, height: 26, border: "none", background: "transparent", borderRadius: 7 }}>
          <X size={14} />
        </button>
        <span className="tv-avatar" style={{ width: 52, height: 52, fontSize: 17, background: convo.color, boxShadow: "0 2px 8px rgba(16,24,40,.14), inset 0 0 0 1px rgba(255,255,255,.2)" }}>{convo.initials}</span>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 11, letterSpacing: -0.2, color: "var(--tv-text)" }}>{convo.name}</div>
        <div style={{ fontSize: 11, color: "var(--tv-faint)", marginTop: 3 }}>August 27th, 2024 @ 8:21 pm</div>
        <button className="tv-chip" style={{ marginTop: 11, cursor: "pointer", color: "#047857", borderColor: "#a7f3d0", background: "#ecfdf5", fontWeight: 600, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
          <span style={{ width: 6, height: 6, borderRadius: 9999, background: "#10b981" }} />Subscribed ▾
        </button>
      </div>
      <div style={{ padding: "14px 16px 16px" }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--tv-faint)", letterSpacing: 0.8, margin: "2px 0 14px" }}>CONTACT DETAILS</div>
        {fields.map(([k, v]) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 13 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: "var(--tv-faint)", marginBottom: 2.5 }}>{k}</div>
              <div className={"tv-field-value" + (v ? "" : " empty")}>{v || "—"}</div>
            </div>
            <Pencil size={12} color="#d1d5db" style={{ cursor: "pointer", flexShrink: 0 }} />
          </div>
        ))}
        <button className="tv-btn-ghost" onClick={onClose} style={{ width: "100%", justifyContent: "center", marginTop: 8, borderRadius: 8, border: "1px solid var(--tv-border)" }}>Close Panel</button>
      </div>
    </div>
  );
}
