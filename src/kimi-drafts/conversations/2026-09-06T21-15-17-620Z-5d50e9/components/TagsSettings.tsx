"use client";

import React, { useState } from "react";
import { ArrowLeft, Plus, Search, Tag as TagIcon } from "lucide-react";
import type { Tag } from "../mock-data";

export function TagsSettings({ tags, onChange, onBack }: { tags: Tag[]; onChange: (t: Tag[]) => void; onBack: () => void }) {
  const [mode, setMode] = useState<"list" | "create">("list");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [color, setColor] = useState("#23ddcd");
  const [untag, setUntag] = useState(false);
  const [saved, setSaved] = useState(false);

  const filtered = tags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  const save = () => {
    if (!name.trim()) return;
    onChange([{ id: Math.random().toString(36).slice(2), name: name.trim(), description: desc.trim(), color, untagOnClose: untag }, ...tags]);
    setSaved(true); setMode("list");
    setName(""); setDesc(""); setColor("#23ddcd"); setUntag(false);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="tv-settings">
      <div className="tv-settings-inner">
        <button type="button" className="tv-btn sm" onClick={mode === "create" ? () => setMode("list") : onBack} style={{ marginBottom: 14 }}>
          <ArrowLeft size={13} /> Back
        </button>

        {mode === "list" ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>Inbox Tags</h2>
                <p style={{ fontSize: 12.5, color: "var(--tv-muted)", marginTop: 3 }}>Create and manage your inbox tags.</p>
              </div>
              <button type="button" className="tv-btn primary" onClick={() => setMode("create")}><Plus size={14} /> Create Tag</button>
            </div>
            {saved ? (
              <div style={{ margin: "12px 0", padding: "9px 13px", borderRadius: 9, background: "var(--tv-green-soft)", border: "1px solid #a7f3d0", color: "var(--tv-green)", fontSize: 12.5, fontWeight: 600 }}>
                Tag created.
              </div>
            ) : null}
            <div style={{ position: "relative", margin: "14px 0" }}>
              <Search size={13} style={{ position: "absolute", left: 10, top: 10, color: "var(--tv-muted)" }} />
              <input className="tv-textinput" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search tags" style={{ paddingLeft: 30 }} />
            </div>
            <div className="tv-card" style={{ overflow: "hidden" }}>
              <table className="tv-table">
                <thead>
                  <tr><th>Name</th><th>Description</th><th>Color</th><th>Untag on close</th></tr>
                </thead>
                <tbody>
                  {filtered.length ? filtered.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--tv-muted)", marginTop: 2 }}>Created on Aug 27th, 2024</div>
                      </td>
                      <td style={{ color: "var(--tv-text-2)", maxWidth: 260 }}>{t.description}</td>
                      <td><span className="tv-tagdot" style={{ background: t.color }} /></td>
                      <td>
                        <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: t.untagOnClose ? "var(--tv-green-soft)" : "var(--tv-bg)", color: t.untagOnClose ? "var(--tv-green)" : "var(--tv-muted)" }}>
                          {t.untagOnClose ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: 28, color: "var(--tv-muted)" }}>No tags match "{q}".</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="tv-card">
            <div className="tv-card-head" style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 28, height: 28, borderRadius: 8, background: "var(--tv-primary-soft)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                <TagIcon size={14} color="var(--tv-primary)" />
              </span>
              Create Tag
            </div>
            <div className="tv-card-body">
              <p style={{ fontSize: 12.5, color: "var(--tv-muted)", marginBottom: 16 }}>Create a new inbox tag for conversations.</p>
              <div className="tv-field">
                <label className="tv-label" htmlFor="tag-name">Tag Name</label>
                <input id="tag-name" className="tv-textinput" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Refund" />
              </div>
              <div className="tv-field">
                <label className="tv-label" htmlFor="tag-desc">Description</label>
                <textarea id="tag-desc" className="tv-textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What is this tag used for?" />
              </div>
              <div className="tv-field">
                <label className="tv-label" htmlFor="tag-color">Tag Color</label>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 30, height: 30, borderRadius: 8, background: color, border: "1px solid var(--tv-border)" }} />
                  <input id="tag-color" className="tv-textinput" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 120, fontFamily: "monospace" }} />
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Pick tag color" style={{ width: 34, height: 34, border: "1px solid var(--tv-border)", borderRadius: 8, background: "#fff", cursor: "pointer", padding: 2 }} />
                </div>
              </div>
              <div className="tv-toggle-row" style={{ border: "none", padding: "4px 0 10px" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Untag When a Conversation is Closed</div>
                  <div className="tv-helper" style={{ maxWidth: 420 }}>
                    When an inbox conversation is marked as closed, this tag is cleared from it. This can help you keep track of your active conversations.
                  </div>
                </div>
                <button type="button" role="switch" aria-checked={untag} aria-label="Untag when a conversation is closed"
                  className={"tv-switch" + (untag ? " on" : "")} onClick={() => setUntag((v) => !v)} />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button type="button" className="tv-btn primary" onClick={save} disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : 0.5 }}>Save</button>
                <button type="button" className="tv-btn" onClick={() => setMode("list")}>Back</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
