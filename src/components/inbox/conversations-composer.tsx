"use client";

import React, { useEffect, useState } from "react";
import { Image, Smile, Braces, SendHorizonal } from "lucide-react";
import { TemplatePicker } from "@/components/inbox/template-picker";
import { MediaPicker } from "@/components/messaging/media-picker";
import type { Teammate } from "@/lib/inbox/conversation-types";

type Props = {
  onSend: (text: string, mediaUrls?: string[]) => void;
  onNote: (text: string) => void;
  disabled?: boolean;
  prefill?: string;
  onPrefillApplied?: () => void;
  teammates?: Teammate[];
  phoneNumbers?: Array<{ id: string; number: string; label?: string }>;
  defaultFromNumberId?: string;
};

/** Production composer for conversations — wires saved replies + MMS attach. */
export function ConversationsComposer({
  onSend,
  onNote,
  disabled,
  prefill = "",
  onPrefillApplied,
  teammates = [],
  phoneNumbers = [],
  defaultFromNumberId = "",
}: Props) {
  const [tab, setTab] = useState<"message" | "note">("message");
  const [text, setText] = useState("");
  const [fromNumberId, setFromNumberId] = useState(defaultFromNumberId);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const note = tab === "note";

  useEffect(() => {
    if (defaultFromNumberId) setFromNumberId(defaultFromNumberId);
  }, [defaultFromNumberId]);

  const mentionCandidates = teammates.filter((t) => t.id !== "me");
  const noteMentionMatch = note ? text.match(/@([\w\s]*)$/) : null;

  const insertMention = (name: string) => {
    const base = text.replace(/@[\w\s]*$/, "");
    setText(`${base}@${name} `);
    setMentionOpen(false);
  };

  useEffect(() => {
    if (!prefill) return;
    setTab("message");
    setText(prefill);
    onPrefillApplied?.();
  }, [prefill, onPrefillApplied]);

  const send = () => {
    if (disabled) return;
    const body = text.trim();
    if (!body && !mediaUrls.length) return;
    if (note) {
      if (!body) return;
      onNote(body);
    } else {
      onSend(body, mediaUrls.length ? mediaUrls : undefined);
    }
    setText("");
    setMediaUrls([]);
  };

  return (
    <>
      <div style={{ borderTop: "1px solid var(--tv-border)", background: "#fff" }}>
        <div style={{ display: "flex", gap: 22, padding: "0 16px", borderBottom: "1px solid var(--tv-border)" }}>
          {(["message", "note"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={"tv-composer-tab" + (tab === t ? " active" : "")}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ padding: 12, background: note ? "#fffbeb" : "#fff", transition: "background .15s" }}>
          <div
            style={{
              border: "1px solid var(--tv-border)",
              borderRadius: 10,
              background: "#fff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(16,24,40,.05)",
            }}
          >
            <textarea
              className="tv-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (note && e.target.value.includes("@")) setMentionOpen(true);
              }}
              placeholder={note ? "Type a note" : "Type a message"}
              rows={3}
              disabled={disabled}
              style={{
                border: "none",
                resize: "none",
                boxShadow: "none",
                background: note ? "#fffbeb" : "#fff",
                padding: "10px 12px",
                lineHeight: 1.55,
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            {note && mentionOpen && noteMentionMatch && mentionCandidates.length > 0 ? (
              <div style={{ padding: "0 12px 8px", maxHeight: 100, overflowY: "auto" }}>
                {mentionCandidates
                  .filter((t) =>
                    !noteMentionMatch[1]?.trim()
                      ? true
                      : t.name.toLowerCase().includes(noteMentionMatch[1].trim().toLowerCase()),
                  )
                  .slice(0, 6)
                  .map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => insertMention(t.name)}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        padding: "6px 8px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      @{t.name}
                    </button>
                  ))}
              </div>
            ) : null}
            {mediaUrls.length > 0 && !note ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 12px 8px" }}>
                {mediaUrls.map((url) => (
                  <span key={url} style={{ position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} />
                    <button
                      type="button"
                      onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))}
                      style={{
                        position: "absolute",
                        top: 2,
                        right: 2,
                        width: 18,
                        height: 18,
                        borderRadius: 9999,
                        border: "none",
                        background: "rgba(0,0,0,.55)",
                        color: "#fff",
                        fontSize: 11,
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "6px 8px",
                borderTop: "1px solid var(--tv-border-soft)",
                background: note ? "#fffbeb" : "#fafbfc",
              }}
            >
              <button
                type="button"
                className="tv-composer-tool"
                title="Attach image"
                disabled={disabled || note}
                onClick={() => setMediaOpen(true)}
              >
                <Image size={16} />
              </button>
              <button type="button" className="tv-composer-tool" title="Emoji" disabled>
                <Smile size={16} />
              </button>
              <button
                type="button"
                className="tv-composer-tool"
                title="Saved replies"
                disabled={disabled || note}
                onClick={() => setTemplatesOpen(true)}
              >
                <Braces size={16} />
              </button>
              {phoneNumbers.length > 1 && !note ? (
                <select
                  className="tv-input"
                  style={{ width: 120, padding: "2px 6px", fontSize: 11, marginLeft: 4 }}
                  value={fromNumberId}
                  onChange={(e) => setFromNumberId(e.target.value)}
                  disabled={disabled}
                >
                  {phoneNumbers.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label || n.number}
                    </option>
                  ))}
                </select>
              ) : null}
              <span style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--tv-faint)",
                  fontVariantNumeric: "tabular-nums",
                  marginRight: 10,
                }}
              >
                {text.length}/918
              </span>
              <button
                type="button"
                className="tv-btn"
                disabled={disabled || (!text.trim() && !mediaUrls.length)}
                onClick={send}
                style={{ padding: "6px 14px", borderRadius: 7, opacity: text.trim() || mediaUrls.length ? 1 : 0.55 }}
              >
                {note ? "Save" : "Send"} <SendHorizonal size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <TemplatePicker
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onSelect={(body) => {
          setText((prev) => (prev ? `${prev} ${body}` : body));
          setTemplatesOpen(false);
        }}
      />
      <MediaPicker
        open={mediaOpen}
        onClose={() => setMediaOpen(false)}
        initialSelected={mediaUrls}
        onConfirm={(urls) => {
          setMediaUrls(urls);
          setMediaOpen(false);
        }}
      />
    </>
  );
}
