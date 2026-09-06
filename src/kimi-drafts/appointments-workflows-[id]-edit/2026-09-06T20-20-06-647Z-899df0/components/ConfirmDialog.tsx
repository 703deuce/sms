"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 60,
        background: "rgba(16,24,40,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        className="modal-panel surface"
        style={{ width: "100%", maxWidth: 420, borderRadius: 14, overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 18px 0" }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
          <button
            onClick={onCancel}
            aria-label="Close"
            style={{
              width: 28, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center",
              borderRadius: 8, border: "none", background: "transparent", color: "var(--muted-foreground)", cursor: "pointer",
            }}
          >
            <X size={15} />
          </button>
        </div>
        <p className="text-muted-foreground" style={{ fontSize: 13, lineHeight: 1.55, margin: 0, padding: "10px 18px 0" }}>
          {body}
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "18px" }}>
          <button
            ref={cancelRef}
            onClick={onCancel}
            style={{
              height: 32, padding: "0 13px", borderRadius: 8, border: "1px solid var(--border)",
              background: "var(--card)", color: "var(--foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 32, padding: "0 13px", borderRadius: 8, border: "none",
              background: danger ? "var(--danger)" : "var(--primary)",
              color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
