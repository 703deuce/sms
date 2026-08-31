"use client";
import React, { useState } from "react";
import { Image, Smile, Braces, SendHorizonal, Loader2 } from "lucide-react";

export default function Composer({
  onSend,
  onNote,
  sending = false,
  onAttach,
}: {
  onSend: (t: string) => void | Promise<void>;
  onNote: (t: string) => void | Promise<void>;
  sending?: boolean;
  onAttach?: () => void;
}) {
  const [tab, setTab] = useState<"message" | "note">("message");
  const [text, setText] = useState("");
  const note = tab === "note";
  const send = async () => {
    if (!text.trim() || sending) return;
    if (note) await onNote(text.trim());
    else await onSend(text.trim());
    setText("");
  };
  return (
    <div style={{ borderTop: "1px solid var(--tv-border)", background: "#fff" }}>
      <div style={{ display: "flex", gap: 20, padding: "0 16px", borderBottom: "1px solid var(--tv-border)" }}>
        {(["message", "note"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={"tv-composer-tab" + (tab === t ? " active" : "")}>{t}</button>
        ))}
      </div>
      <div style={{ padding: 12, background: note ? "#fffbeb" : "#fff", transition: "background .15s" }}>
        <div style={{ border: "1px solid var(--tv-border)", borderRadius: 10, background: "#fff", overflow: "hidden", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
          <textarea
            className="tv-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={note ? "Type a note" : "Type a message"}
            rows={3}
            disabled={sending}
            style={{ border: "none", resize: "none", boxShadow: "none", background: note ? "#fffbeb" : "#fff", padding: "10px 12px" }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "5px 8px", borderTop: "1px solid var(--tv-border-soft)", background: note ? "#fffbeb" : "#fff" }}>
            <button type="button" className="tv-composer-tool" title="Attach image" onClick={onAttach} disabled={note}><Image size={16} /></button>
            <button type="button" className="tv-composer-tool" title="Emoji" disabled><Smile size={16} /></button>
            <button type="button" className="tv-composer-tool" title="Merge fields" disabled><Braces size={16} /></button>
            <span style={{ flex: 1 }} />
            <button type="button" className="tv-btn" disabled={!text.trim() || sending} onClick={() => void send()} style={{ padding: "6px 14px", borderRadius: 7 }}>
              {sending ? <Loader2 size={13} className="animate-spin" /> : null}
              {note ? "Save" : "Send"} <SendHorizonal size={13} />
            </button>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 10.5, color: "var(--tv-faint)", padding: "0 16px 8px", fontVariantNumeric: "tabular-nums" }}>{text.length}/918</div>
    </div>
  );
}
