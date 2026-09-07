"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, X } from "lucide-react";

export function RunResultDialog({
  result,
  onClose,
}: {
  result: { sent: number; targeted: number; name: string };
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rc-dialog-backdrop" onClick={onClose}>
      <div
        className="rc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rc-run-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" aria-hidden="true" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <h3 id="rc-run-title" className="mt-3 font-display text-base font-semibold tracking-tight">
          Campaign run complete
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{result.name}</span> sent{" "}
          <span className="font-semibold text-foreground">{result.sent.toLocaleString("en-US")}</span>{" "}
          of {result.targeted.toLocaleString("en-US")} targeted contacts. Contacts without
          valid consent or with an upcoming appointment were skipped automatically.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[hsl(var(--primary-hover))]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
