"use client";
import React, { useState } from "react";
import { Search, Tag as TagIcon, ChevronRight, MoreVertical } from "lucide-react";
import { Tag } from "../mock-data";

const PALETTE = ["#23ddcd", "#6a329f", "#ef4444", "#f59e0b", "#22c55e", "#0ea5e9", "#8b5cf6", "#ec4899", "#a3e635", "#64748b"];

export default function TagsSettings({ tags, onCreate, onBack }:{
  tags: Tag[]; onCreate: (t: Omit<Tag, "id" | "created">)=>void; onBack: ()=>void;
}) {
  const [view, setView] = useState<"list" | "create">("list");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#23ddcd");
  const [untag, setUntag] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState(false);

  const save = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), description: desc.trim(), color, untagOnClose: untag });
    setName(""); setDesc(""); setColor("#23ddcd"); setUntag(false);
    setView("list"); setToast(true); setTimeout(() => setToast(false), 2500);
  };

  if (view === "create") return (
    <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: 32, background: "#fbfcfd" }}>
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>Settings / Inbox / Tags / <span style={{ color: "#111827" }}>Create Tag</span></div>
      <h2 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "#ccfbf1", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><TagIcon size={16} color="#14b8a6" /></span>
        Create Tag
      </h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 24px" }}>Create a new inbox tag for conversations.</p>
      <div style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Tag Name</label>
          <input className="tv-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Refund" />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Description</label>
          <textarea className="tv-input" rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Refund request subject matter" style={{ resize: "vertical" }} />
        </div>
        <div style={{ position: "relative" }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>Tag Color</label>
          <div onClick={() => setPaletteOpen(!paletteOpen)} style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--tv-border)", borderRadius: 6, padding: "7px 12px", cursor: "pointer", background: "#fff", maxWidth: 200 }}>
            <span style={{ width: 18, height: 18, borderRadius: 4, background: color }} />
            <span style={{ fontSize: 13 }}>{color}</span>
          </div>
          {paletteOpen && (
            <div className="ref-pop" style={{ position: "absolute", top: "100%", marginTop: 6, background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 8, padding: 10, display: "grid", gridTemplateColumns: "repeat(5, 26px)", gap: 6, boxShadow: "0 8px 24px rgba(0,0,0,.12)", zIndex: 20 }}>
              {PALETTE.map((c) => (
                <button key={c} onClick={() => { setColor(c); setPaletteOpen(false); }} style={{ width: 26, height: 26, borderRadius: 6, background: c, border: c === color ? "2px solid #111827" : "1px solid rgba(0,0,0,.1)", cursor: "pointer" }} />
              ))}
            </div>
          )}
        </div>
        <div style={{ borderTop: "1px solid var(--tv-border)", paddingTop: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <TagIcon size={14} color="#6b7280" />
            <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>Untag When a Conversation is Closed</span>
            <button className={"tv-toggle" + (untag ? " on" : "")} onClick={() => setUntag(!untag)} />
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "8px 0 0" }}>
            When an inbox conversation is marked as closed, you have the option to clear this tag from it. This can help you keep track of your active conversations.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="tv-btn" onClick={save}>Save</button>
          <button className="tv-btn-ghost" onClick={() => setView("list")}>Back</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ref-scroll" style={{ flex: 1, overflowY: "auto", padding: 32, background: "#fbfcfd", position: "relative" }}>
      {toast && <div className="ref-pop" style={{ position: "fixed", top: 18, right: 18, background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 600, padding: "10px 18px", borderRadius: 8, zIndex: 60 }}>Tag created ✓</div>}
      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ cursor: "pointer" }} onClick={onBack}>Settings</span><ChevronRight size={11} /> Inbox <ChevronRight size={11} /> <span style={{ color: "#111827" }}>Tags</span>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "#ccfbf1", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><TagIcon size={16} color="#14b8a6" /></span>
        Inbox Tags
      </h2>
      <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 20px" }}>Create and manage your inbox tags.</p>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 14 }}>
        <div style={{ position: "relative" }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: 10, color: "#9ca3af" }} />
          <input className="tv-input" placeholder="Search" style={{ paddingLeft: 30, width: 220 }} />
        </div>
        <button className="tv-btn" onClick={() => setView("create")}>Create Tag</button>
      </div>
      <div style={{ background: "#fff", border: "1px solid var(--tv-border)", borderRadius: 10, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left", fontSize: 11, color: "#6b7280" }}>
              {["NAME", "DESCRIPTION", "COLOR", "UNTAG ON CLOSE", ""].map((h) => <th key={h} style={{ padding: "10px 16px", fontWeight: 700 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>Created on {t.created}</div>
                </td>
                <td style={{ padding: "12px 16px", color: "#4b5563" }}>{t.description}</td>
                <td style={{ padding: "12px 16px" }}><TagIcon size={16} color={t.color} fill={t.color} /></td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: t.untagOnClose ? "#059669" : "#6b7280", background: t.untagOnClose ? "#ecfdf5" : "#f3f4f6", borderRadius: 9999, padding: "3px 10px" }}>{t.untagOnClose ? "Yes" : "No"}</span>
                </td>
                <td style={{ padding: "12px 16px" }}><MoreVertical size={15} color="#9ca3af" style={{ cursor: "pointer" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ padding: "10px 16px", borderTop: "1px solid #f3f4f6" }}>
          <select className="tv-input" style={{ width: 110 }}><option>25 Per Page</option></select>
        </div>
      </div>
    </div>
  );
}
