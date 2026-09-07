import { useEffect, useRef } from "react";
import type { WaitlistEntry } from "../mock-data";

export function ConfirmRemoveModal({
  entry,
  busy,
  onCancel,
  onConfirm,
}: {
  entry: WaitlistEntry;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const who = entry.phone || entry.email || "this customer";

  return (
    <div
      className="tv-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="tv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-dialog-title"
      >
        <h2 className="tv-modal-title" id="remove-dialog-title">
          Remove from waitlist?
        </h2>
        <p className="tv-modal-desc">
          {who} will be removed from the waitlist
          {entry.serviceName ? ` for ${entry.serviceName}` : ""}. They will no
          longer be notified when a slot opens. You can reactivate the entry
          later from this page.
        </p>
        <div className="tv-modal-actions">
          <button
            ref={cancelRef}
            className="tv-btn tv-btn--outline"
            onClick={onCancel}
            disabled={busy}
          >
            Keep entry
          </button>
          <button
            className="tv-btn tv-btn--danger-solid"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Removing…" : "Remove from waitlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
