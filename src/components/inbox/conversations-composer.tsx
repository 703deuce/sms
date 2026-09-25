"use client";

import React, { useEffect, useRef, useState } from "react";
import { Image, Smile, Braces, SendHorizonal } from "lucide-react";
import { TemplatePicker } from "@/components/inbox/template-picker";
import { MediaPicker } from "@/components/messaging/media-picker";
import { EmojiPickerPopover } from "@/components/messaging/emoji-picker-popover";
import type { Teammate } from "@/lib/inbox/conversation-types";

type Props = {
  onSend: (text: string, mediaUrls?: string[], fromE164?: string) => void;
  onNote: (text: string) => void;
  disabled?: boolean;
  prefill?: string;
  onPrefillApplied?: () => void;
  teammates?: Teammate[];
  phoneNumbers?: Array<{ id: string; number: string; label?: string }>;
  defaultFromNumberId?: string;
  /** When false, only internal notes (no customer SMS composer). */
  smsEnabled?: boolean;
  showSavedReplies?: boolean;
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
  smsEnabled = true,
  showSavedReplies = true,
}: Props) {
  const [tab, setTab] = useState<"message" | "note">(smsEnabled ? "message" : "note");
  const [text, setText] = useState("");
  const [fromNumberId, setFromNumberId] = useState(defaultFromNumberId);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiBtnRef = useRef<HTMLButtonElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const note = tab === "note";

  useEffect(() => {
    if (defaultFromNumberId) setFromNumberId(defaultFromNumberId);
  }, [defaultFromNumberId]);

  useEffect(() => {
    if (!smsEnabled) setTab("note");
  }, [smsEnabled]);

  const mentionCandidates = teammates.filter((t) => t.id !== "me");
  const noteMentionMatch = note ? text.match(/@([\w\s]*)$/) : null;

  const insertMention = (name: string) => {
    const base = text.replace(/@[\w\s]*$/, "");
    setText(`${base}@${name} `);
    setMentionOpen(false);
  };

  useEffect(() => {
    if (!prefill) return;
    if (smsEnabled) setTab("message");
    setText(prefill);
    onPrefillApplied?.();
  }, [prefill, onPrefillApplied]);

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const send = () => {
    if (disabled) return;
    const body = text.trim();
    if (!body && !mediaUrls.length) return;
    if (note) {
      if (!body) return;
      onNote(body);
    } else {
      const fromE164 = phoneNumbers.find((n) => n.id === fromNumberId)?.number;
      onSend(body, mediaUrls.length ? mediaUrls : undefined, fromE164);
    }
    setText("");
    setMediaUrls([]);
  };

  const canSend = !disabled && (Boolean(text.trim()) || mediaUrls.length > 0);

  return (
    <>
      <div style={{ borderTop: "1px solid var(--tv-border)", background: "#fff" }}>
        <div style={{ display: "flex", gap: 22, padding: "0 16px", borderBottom: "1px solid var(--tv-border)" }}>
          {(smsEnabled ? (["message", "note"] as const) : (["note"] as const)).map((t) => (
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
              borderRadius: 12,
              background: "#fff",
              overflow: "hidden",
              boxShadow: "0 1px 2px rgba(16,24,40,.05)",
            }}
          >
            <textarea
              ref={textareaRef}
              className="tv-input"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (note && e.target.value.includes("@")) setMentionOpen(true);
              }}
              placeholder={note ? "Type an internal note — only your team can see this" : "Type a message"}
              rows={3}
              disabled={disabled}
              style={{
                border: "none",
                resize: "none",
                boxShadow: "none",
                background: note ? "#fffbeb" : "#fff",
                padding: "10px 12px",
                lineHeight: 1.55,
                borderRadius: 0,
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
                        borderRadius: 6,
                        color: "var(--tv-text-2)",
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
                    <img
                      src={url}
                      alt=""
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: "cover",
                        borderRadius: 8,
                        border: "1px solid var(--tv-border)",
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Remove attachment"
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
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
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
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <button
                  type="button"
                  ref={emojiBtnRef}
                  className="tv-composer-tool"
                  title="Emoji"
                  disabled={disabled || note}
                  onClick={() => setEmojiOpen((v) => !v)}
                >
                  <Smile size={16} />
                </button>
                <EmojiPickerPopover
                  open={emojiOpen}
                  onClose={() => setEmojiOpen(false)}
                  onSelect={insertEmoji}
                  anchorRef={emojiBtnRef}
                />
              </div>
              {showSavedReplies && smsEnabled ? (
                <button
                  type="button"
                  className="tv-composer-tool"
                  title="Saved replies"
                  disabled={disabled || note}
                  onClick={() => setTemplatesOpen(true)}
                >
                  <Braces size={16} />
                </button>
              ) : null}
              {phoneNumbers.length > 1 && !note ? (
                <select
                  className="tv-input"
                  style={{ width: 120, padding: "3px 6px", fontSize: 11, marginLeft: 4, borderRadius: 7 }}
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
                disabled={!canSend}
                onClick={send}
                style={{ padding: "6px 14px", borderRadius: 8 }}
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
