"use client";
import React, { useState } from "react";
import { Image, Smile, Braces } from "lucide-react";

export default function Composer({ onSend, onNote }:{ onSend: (t: string)=>void; onNote: (t: string)=>void }) {
  const [tab, setTab] = useState<"message" | "note">("message");
  const [text, setText] = useState("");
  const note = tab === "note";
  const send = () => { if (!text.trim()) return; note ? onNote(text.trim()) : onSend(text.trim()); setText(""); };
  return (
    <div style={{ borderTop: "1px solid var(--tv-border)", background: "#fff" }}>
      <div style={{ display: "flex", gap: 20, padding: "0 16px", borderBottom: "1px solid var(--tv-border)" }}>
        {(["message", "note"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: "none", border: "none", padding: "10px 2px", fontSize: 13, cursor: "pointer",
            fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--tv-primary)" : "#6b7280",
            borderBottom: tab === t ? "2px solid var(--tv-primary)" : "2px solid transparent", textTransform: "capitalize",
          }}>{t}</button>
        ))}
      </div>
      <div style={{ padding: 12, background: note ? "#fffbeb" : "#fff" }}>
        <div style={{ border: "1px solid var(--tv-border)", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
          <textarea className="tv-input" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={note ? "Type a note" : "Type a message"} rows={3}
            style={{ border: "none", resize: "none", boxShadow: "none", background: note ? "#fffbeb" : "#fff" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 10px", background: note ? "#fffbeb" : "#fff" }}>
            <Image size={16} color="#9ca3af" style={{ cursor: "pointer" }} />
            <Smile size={16} color="#9ca3af" style={{ cursor: "pointer" }} />
            <Braces size={16} color="#9ca3af" style={{ cursor: "pointer" }} />
            <span style={{ flex: 1 }} />
            <button className="tv-btn" disabled={!text.trim()} onClick={send} style={{ padding: "6px 14px" }}>
              {note ? "Save" : "Send"} <span style={{ opacity: .8 }}>▸</span>
            </button>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 10.5, color: "#9ca3af", padding: "0 16px 8px" }}>{text.length}/918</div>
    </div>
  );
}
