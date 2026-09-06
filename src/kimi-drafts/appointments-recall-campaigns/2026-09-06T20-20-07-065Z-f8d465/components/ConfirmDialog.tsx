"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert, X } from "lucide-react";

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Focus the safe action by default
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  return (
    <div className="rc-dialog-backdrop" onClick={() => !busy && onClose()}>
      <div
        className="rc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rc-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${destructive ? "bg-red-50" : "bg-[hsl(var(--primary))]/10"}`}>
            <TriangleAlert
              className={`h-5 w-5 ${destructive ? "text-[hsl(var(--danger))]" : "text-[hsl(var(--primary))]"}`}
              aria-hidden="true"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <h3 id="rc-confirm-title" className="mt-3 font-display text-base font-semibold tracking-tight">
          {title}
        </h3>
        <div className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 ${
              destructive
                ? "bg-[hsl(var(--danger))] text-[hsl(var(--danger-foreground))] hover:opacity-90"
                : "bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary-hover))]"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
