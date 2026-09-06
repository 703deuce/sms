"use client";

import { useEffect } from "react";
import { X, CheckCircle2, AlertTriangle, Trash2, Loader2 } from "lucide-react";

export interface KimiImportResult {
  created: number;
  updated: number;
  suppressedSkipped: number;
  errors: Array<{ row: number; error: string }>;
}

export function ImportStartedModal({
  onClose,
  result,
}: {
  onClose: () => void;
  result?: KimiImportResult | null;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasErrors = (result?.errors?.length ?? 0) > 0;
  const title = result ? (hasErrors ? "Import finished with errors" : "Import complete") : "Import started";
  const summary = result
    ? `${result.created.toLocaleString()} created · ${result.updated.toLocaleString()} updated${
        result.suppressedSkipped
          ? ` · ${result.suppressedSkipped.toLocaleString()} skipped (opted out)`
          : ""
      }${hasErrors ? ` · ${result.errors.length.toLocaleString()} row errors` : ""}`
    : "We're working on importing the contacts in your file. You'll receive a notification once it's finished.";

  const stats = result
    ? [
        { label: "Created", value: result.created, tone: "text-emerald-600" },
        { label: "Updated", value: result.updated, tone: "text-foreground" },
        { label: "Skipped", value: result.suppressedSkipped, tone: "text-amber-600" },
        { label: "Errors", value: result.errors.length, tone: hasErrors ? "text-rose-600" : "text-foreground" },
      ]
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl animate-in zoom-in-95 fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex justify-center">
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full ${
              hasErrors ? "bg-amber-50 ring-8 ring-amber-50/60" : "bg-emerald-50 ring-8 ring-emerald-50/60"
            }`}
          >
            {hasErrors ? (
              <AlertTriangle className="h-7 w-7 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            )}
          </span>
        </div>
        <h2 className="mb-2 font-display text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mx-auto mb-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">{summary}</p>

        {stats && (
          <div className="mx-auto mb-5 grid max-w-sm grid-cols-4 divide-x divide-border rounded-xl border border-border bg-muted/30">
            {stats.map((s) => (
              <div key={s.label} className="px-2 py-3">
                <p className={`font-display text-base font-semibold tabular-nums ${s.tone}`}>
                  {s.value.toLocaleString()}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {hasErrors && result ? (
          <div className="kc-scroll mx-auto mb-6 max-h-36 max-w-sm overflow-y-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-[12px] text-muted-foreground">
            {result.errors.slice(0, 8).map((err) => (
              <p key={`${err.row}-${err.error}`} className="py-0.5">
                <span className="font-medium text-foreground">Row {err.row + 1}:</span> {err.error}
              </p>
            ))}
            {result.errors.length > 8 ? (
              <p className="pt-1 text-[11px] text-muted-foreground/80">+{result.errors.length - 8} more row errors</p>
            ) : null}
          </div>
        ) : (
          !stats && <div className="mb-7" />
        )}

        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-lg bg-primary px-10 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export function ConfirmDeleteModal({
  label,
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  label: string;
  count: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [busy, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={() => {
        if (!busy) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Delete contacts"
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 ring-8 ring-rose-50/60">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </span>
        </div>
        <h2 className="mb-1.5 text-center font-display text-[16px] font-semibold tracking-tight text-foreground">
          Delete {count === 1 ? "this contact" : `${count} contacts`}?
        </h2>
        <p className="mx-auto mb-5 max-w-xs text-center text-[13px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{label}</span> will be permanently removed. Their appointment
          history is kept, but the contact record can&rsquo;t be recovered.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 flex-1 rounded-lg border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
