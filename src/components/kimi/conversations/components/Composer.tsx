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
      <div style={{ display: "flex", gap: 20, padding: "0 16px", borderBottom: "1px solid var(--tv-border)" }}>
        {(["message", "note"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={"tv-composer-tab" + (tab === t ? " active" : "")}>{t}</button>
        ))}
      </div>
      <div style={{ padding: 12, background: note ? "#fffbeb" : "#fff", transition: "background .15s" }}>
        <div style={{ border: "1px solid var(--tv-border)", borderRadius: 10, background: "#fff", overflow: "hidden", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
          <textarea className="tv-input" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={note ? "Type a note" : "Type a message"} rows={3}
            style={{ border: "none", resize: "none", boxShadow: "none", background: note ? "#fffbeb" : "#fff", padding: "10px 12px" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "5px 8px", borderTop: "1px solid var(--tv-border-soft)", background: note ? "#fffbeb" : "#fff" }}>
            <button className="tv-composer-tool" title="Attach image"><Image size={16} /></button>
            <button className="tv-composer-tool" title="Emoji"><Smile size={16} /></button>
            <button className="tv-composer-tool" title="Merge fields"><Braces size={16} /></button>
            <span style={{ flex: 1 }} />
            <button className="tv-btn" disabled={!text.trim()} onClick={send} style={{ padding: "6px 14px", borderRadius: 7 }}>
              {note ? "Save" : "Send"} <SendHorizonal size={13} />
            </button>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 10.5, color: "var(--tv-faint)", padding: "0 16px 8px", fontVariantNumeric: "tabular-nums" }}>{text.length}/918</div>
    </div>
  );
}
