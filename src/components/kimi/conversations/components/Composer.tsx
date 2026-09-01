"use client";
import React, { useState } from "react";
import { Image, Smile, Braces, SendHorizonal } from "lucide-react";

export default function Composer({ onSend, onNote }:{ onSend: (t: string)=>void; onNote: (t: string)=>void }) {
  const [tab, setTab] = useState<"message" | "note">("message");
  const [text, setText] = useState("");
  const note = tab === "note";
  const send = () => { if (!text.trim()) return; note ? onNote(text.trim()) : onSend(text.trim()); setText(""); };
  return (
    <div style={{ borderTop: "1px solid var(--tv-border)", background: "#fff" }}>
      <div style={{ display: "flex", gap: 22, padding: "0 16px", borderBottom: "1px solid var(--tv-border)" }}>
        {(["message", "note"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={"tv-composer-tab" + (tab === t ? " active" : "")}>{t}</button>
        ))}
      </div>
      <div style={{ padding: 12, background: note ? "#fffbeb" : "#fff", transition: "background .15s" }}>
        <div style={{
          border: "1px solid var(--tv-border)", borderRadius: 10, background: "#fff", overflow: "hidden",
          boxShadow: "0 1px 2px rgba(16,24,40,.05)",
          transition: "border-color .15s, box-shadow .15s",
        }}>
          <textarea className="tv-input" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={note ? "Type a note" : "Type a message"} rows={3}
            style={{ border: "none", resize: "none", boxShadow: "none", background: note ? "#fffbeb" : "#fff", padding: "10px 12px", lineHeight: 1.55 }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "6px 8px", borderTop: "1px solid var(--tv-border-soft)", background: note ? "#fffbeb" : "#fafbfc" }}>
            <button className="tv-composer-tool" title="Attach image"><Image size={16} /></button>
            <button className="tv-composer-tool" title="Emoji"><Smile size={16} /></button>
            <button className="tv-composer-tool" title="Merge fields"><Braces size={16} /></button>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 10.5, color: "var(--tv-faint)", fontVariantNumeric: "tabular-nums", marginRight: 10 }}>{text.length}/918</span>
            <button className="tv-btn" disabled={!text.trim()} onClick={send} style={{ padding: "6px 14px", borderRadius: 7, opacity: text.trim() ? 1 : 0.55 }}>
              {note ? "Save" : "Send"} <SendHorizonal size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
