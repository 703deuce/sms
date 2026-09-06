import React, { useEffect, useRef } from "react";
import { X, AlertTriangle } from "lucide-react";

export function ConfirmDeleteModal({
  open, saving, title, body, confirmLabel, onClose, onConfirm,
}: {
  open: boolean;
  saving: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => cancelRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-delete-title" style={{ maxWidth: 440 }}>
        <div style={{ display: "flex", alignItems: "center", padding: "18px 20px 0" }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: "var(--danger-soft)",
            color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center",
            marginRight: 11, flex: "none",
          }}>
            <AlertTriangle size={17} />
          </div>
          <h2 id="confirm-delete-title" style={{ fontSize: 15.5, fontWeight: 650, margin: 0, flex: 1 }}>
            {title}
          </h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div style={{ padding: "12px 20px 4px", fontSize: 13.5, color: "var(--fg-muted)", lineHeight: 1.55 }}>
          {body}
        </div>
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "14px 20px",
        }}>
          <button ref={cancelRef} className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={saving}>
            {saving ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
