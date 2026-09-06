"use client";

import { useEffect } from "react";
import type { SavedReply } from "../mock-data";

export function DeleteReplyDialog({
  reply,
  onCancel,
  onConfirm,
}: {
  reply: SavedReply;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Escape cancels the destructive confirmation
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="sr-drawer-overlay" onClick={onCancel}>
      <div
        className="sr-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sr-del-title"
        aria-describedby="sr-del-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sr-del-title" className="sr-modal-title">
          Delete “{reply.name}”?
        </h2>
        <p id="sr-del-desc" className="sr-modal-desc">
          This saved reply will be permanently removed. Conversations that already used it are not
          affected.
        </p>
        <div className="sr-modal-actions">
          <button className="sr-btn sr-btn-outline" onClick={onCancel} autoFocus>
            Keep reply
          </button>
          <button className="sr-btn sr-btn-danger" onClick={onConfirm}>
            Delete reply
          </button>
        </div>
      </div>
    </div>
  );
}
