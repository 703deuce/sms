"use client";

import { X } from "lucide-react";

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div className="modal modal-sm">
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onCancel} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55 }}>{message}</p>
        </div>
        <div className="modal-foot">
          <button className="btn btn-outline" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button className={destructive ? "btn btn-danger-solid" : "btn btn-primary"} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
