"use client";
import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="tv-modal-scrim" onClick={onCancel}>
      <div
        className="tv-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="tv-modal-title"
        aria-describedby="tv-modal-body"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="tv-icon-btn tv-modal-close" aria-label="Close dialog" onClick={onCancel}>
          <X size={15} />
        </button>
        <div className="tv-modal-icon"><AlertTriangle size={18} /></div>
        <h2 className="tv-modal-title" id="tv-modal-title">{title}</h2>
        <p className="tv-modal-body" id="tv-modal-body">{body}</p>
        <div className="tv-modal-actions">
          <button ref={cancelRef} className="tv-btn tv-btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="tv-btn tv-btn-danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
