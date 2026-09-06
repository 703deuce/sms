"use client";

import React, { useState } from "react";
import { Search, SendHorizonal, X } from "lucide-react";
import type { Conversation } from "../mock-data";

export function NewMessageModal({
  conversations, onClose, onStart,
}: {
  conversations: Conversation[]; onClose: () => void; onStart: (convo: Conversation, text: string) => void;
}) {
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Conversation | null>(null);
  const [text, setText] = useState("");

  const matches = q.trim()
    ? conversations.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q.trim()))
    : conversations.slice(0, 6);

  return (
    <div className="tv-modal-wrap" role="presentation" onClick={onClose}>
      <div className="tv-modal" role="dialog" aria-modal="true" aria-label="Compose new message" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--tv-border)" }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>Compose New Message</span>
          <button type="button" className="tv-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ padding: 18 }}>
          {!target ? (
            <>
              <label className="tv-label" htmlFor="nm-to">To:</label>
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 10, top: 10, color: "var(--tv-muted)" }} />
                <input id="nm-to" className="tv-textinput" placeholder="Search or create new contact" value={q} onChange={(e) => setQ(e.target.value)} style={{ paddingLeft: 30 }} autoFocus />
              </div>
              <p className="tv-helper" style={{ margin: "8px 0 10px" }}>Search contacts by name or number. Provide a new number to create a contact.</p>
              <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
                {matches.length ? matches.map((c) => (
                  <button key={c.id} type="button" className="tv-pop-item" onClick={() => setTarget(c)}>
                    <span className="tv-avatar" style={{ width: 26, height: 26, fontSize: 9.5 }}>{c.initials}</span>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <span style={{ fontSize: 11.5, color: "var(--tv-muted)" }}>{c.phone}</span>
                  </button>
                )) : (
                  <button type="button" className="tv-pop-item" onClick={() => setTarget({ id: "new", contactId: "new", name: q, initials: q.slice(0, 2).toUpperCase() || "?", phone: q, preview: "", time: "now", unread: false, status: "Open", assignee: "Me", tags: [], messages: [] })}>
                    Create new contact "{q}"
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, background: "var(--tv-bg)", border: "1px solid var(--tv-border-soft)", marginBottom: 12 }}>
                <span className="tv-avatar" style={{ width: 28, height: 28, fontSize: 10 }}>{target.initials}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{target.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--tv-muted)" }}>{target.phone}</div>
                </div>
                <button type="button" className="tv-btn sm" onClick={() => setTarget(null)}>Change</button>
              </div>
              <label className="tv-label" htmlFor="nm-body">Message</label>
              <textarea id="nm-body" className="tv-textarea" rows={4} placeholder="Type a message" value={text} onChange={(e) => setText(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && text.trim()) { e.preventDefault(); onStart(target, text.trim()); } }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button type="button" className="tv-btn" onClick={onClose}>Cancel</button>
                <button type="button" className="tv-send" disabled={!text.trim()} onClick={() => onStart(target, text.trim())}>
                  Send <SendHorizonal size={13} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
