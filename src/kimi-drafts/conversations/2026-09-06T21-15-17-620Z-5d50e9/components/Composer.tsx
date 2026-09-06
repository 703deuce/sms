"use client";

import React, { useRef, useState } from "react";
import { Image, Smile, Braces, SendHorizonal, X } from "lucide-react";
import { SAVED_REPLIES, type Teammate } from "../mock-data";

export function Composer({
  onSend, onNote, disabled, prefill = "", onPrefillApplied, teammates = [],
}: {
  onSend: (text: string, mediaUrls?: string[]) => void; onNote: (text: string) => void; disabled?: boolean;
  prefill?: string; onPrefillApplied?: () => void; teammates?: Teammate[];
}) {
  const [tab, setTab] = useState<"message" | "note">("message");
  const [text, setText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [media, setMedia] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const note = tab === "note";

  React.useEffect(() => {
    if (!prefill) return;
    setTab("message"); setText(prefill); onPrefillApplied?.();
  }, [prefill, onPrefillApplied]);

  const mentionCandidates = teammates.filter((t) => t.id !== "me");
  const noteMentionMatch = note ? text.match(/@([\w\s]*)$/) : null;

  const insertMention = (name: string) => {
    const base = text.replace(/@[\w\s]*$/, "");
    setText(`${base}@${name} `);
    setMentionOpen(false);
  };

  const insertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
    setEmojiOpen(false);
    textareaRef.current?.focus();
  };

  const onFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const names = Array.from(files).map((f) => f.name);
    setMedia((prev) => [...prev, ...names]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const send = () => {
    if (disabled) return;
    const body = text.trim();
    if (!body && !media.length) return;
    if (note) {
      if (!body) return;
      onNote(body);
    } else {
      onSend(body, media.length ? media : undefined);
    }
    setText("");
    setMedia([]);
  };

  const canSend = !disabled && (Boolean(text.trim()) || media.length > 0);

  return (
    <div style={{ borderTop: "1px solid var(--tv-border)", background: "#fff" }}>
      <div style={{ display: "flex", gap: 22, padding: "0 16px", borderBottom: "1px solid var(--tv-border-soft)" }} role="tablist">
        {(["message", "note"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={"tv-composer-tab" + (tab === t ? " active" : "")}>{t}</button>
        ))}
        <span style={{ marginLeft: "auto", alignSelf: "center", fontSize: 11, color: "var(--tv-muted)" }}>{text.length}/918</span>
      </div>
      <div style={{ padding: 12, background: note ? "#fffbeb" : "#fff", transition: "background .15s" }}>
        <div style={{ border: "1px solid var(--tv-border)", borderRadius: 12, background: "#fff", overflow: "hidden", boxShadow: "var(--tv-shadow-sm)" }}>
          <textarea
            ref={textareaRef}
            className="tv-input"
            value={text}
            onChange={(e) => { setText(e.target.value); if (note && e.target.value.includes("@")) setMentionOpen(true); }}
            placeholder={note ? "Type an internal note — only your team can see this" : "Type a message"}
            rows={3}
            disabled={disabled}
            aria-label={note ? "Internal note" : "Message"}
            style={{ border: "none", resize: "none", boxShadow: "none", background: note ? "#fffbeb" : "#fff", padding: "10px 12px", lineHeight: 1.55 }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          />
          {note && mentionOpen && noteMentionMatch && mentionCandidates.length > 0 ? (
            <div style={{ padding: "0 12px 8px" }}>
              {mentionCandidates
                .filter((t) => !noteMentionMatch[1]?.trim() ? true : t.name.toLowerCase().includes(noteMentionMatch[1].trim().toLowerCase()))
                .slice(0, 6)
                .map((t) => (
                  <button key={t.id} type="button" onClick={() => insertMention(t.name)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", border: "none", background: "transparent", borderRadius: 6, fontSize: 12.5, cursor: "pointer" }}>
                    @{t.name}
                  </button>
                ))}
            </div>
          ) : null}
          {media.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 12px 8px" }}>
              {media.map((m) => (
                <span key={m} className="tv-attach">
                  <Image size={11} /> {m}
                  <button type="button" aria-label={`Remove ${m}`} onClick={() => setMedia((prev) => prev.filter((u) => u !== m))}
                    style={{ display: "inline-flex", background: "none", border: "none", cursor: "pointer", color: "var(--tv-muted)", padding: 0 }}>
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 8px", borderTop: "1px solid var(--tv-border-soft)" }}>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf" hidden onChange={(e) => onFiles(e.target.files)} />
            <button type="button" className="tv-iconbtn" title="Attach media" aria-label="Attach media" disabled={disabled || note}
              onClick={() => fileRef.current?.click()}><Image size={15} /></button>
            <div style={{ position: "relative" }}>
              <button type="button" className="tv-iconbtn" title="Emoji" aria-label="Insert emoji" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((v) => !v)} disabled={disabled}><Smile size={15} /></button>
              {emojiOpen ? (
                <div className="tv-pop" style={{ bottom: "calc(100% + 6px)", left: 0, top: "auto", display: "flex", gap: 4, padding: 8, minWidth: 0 }}>
                  {["👍", "😊", "🎉", "✅", "🙏", "📅"].map((e) => (
                    <button key={e} type="button" className="tv-iconbtn" onClick={() => insertEmoji(e)} style={{ fontSize: 16 }}>{e}</button>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ position: "relative" }}>
              <button type="button" className="tv-iconbtn" title="Saved replies" aria-label="Saved replies" aria-expanded={templatesOpen}
                onClick={() => setTemplatesOpen((v) => !v)} disabled={disabled}><Braces size={15} /></button>
              {templatesOpen ? (
                <div className="tv-pop" style={{ bottom: "calc(100% + 6px)", left: 0, top: "auto", width: 300 }}>
                  <div className="tv-pop-label">Saved replies</div>
                  {SAVED_REPLIES.map((r) => (
                    <button key={r.id} type="button" className="tv-pop-item" style={{ alignItems: "flex-start", flexDirection: "column", gap: 2 }}
                      onClick={() => { setText((prev) => (prev ? prev + " " : "") + r.body); setTemplatesOpen(false); textareaRef.current?.focus(); }}>
                      <span style={{ fontWeight: 700, fontSize: 12 }}>{r.name}</span>
                      <span style={{ fontSize: 11.5, color: "var(--tv-muted)", lineHeight: 1.4 }}>{r.body}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button type="button" className="tv-send" onClick={send} disabled={!canSend}>
                {note ? "Add note" : "Send"} <SendHorizonal size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
