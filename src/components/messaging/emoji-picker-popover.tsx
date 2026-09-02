"use client";

import React, { useRef, useEffect } from "react";

export const COMMON_EMOJIS = [
  "😀",
  "😂",
  "🎉",
  "❤️",
  "👍",
  "🔥",
  "✨",
  "📣",
  "🎁",
  "💰",
  "📅",
  "👋",
  "⭐",
  "😊",
  "🙏",
  "💬",
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
};

export function EmojiPickerPopover({ open, onClose, onSelect, anchorRef }: Props) {
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={popRef}
      className="ref-pop"
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: 6,
        background: "#fff",
        border: "1px solid var(--tv-border)",
        borderRadius: 10,
        padding: 10,
        display: "grid",
        gridTemplateColumns: "repeat(8, 28px)",
        gap: 4,
        boxShadow: "0 10px 28px rgba(16,24,40,.14)",
        zIndex: 30,
      }}
    >
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelect(emoji);
            onClose();
          }}
          style={{
            width: 28,
            height: 28,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontSize: 18,
            borderRadius: 6,
          }}
          title={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
