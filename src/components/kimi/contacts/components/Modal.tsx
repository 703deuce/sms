"use client";
import { X, CheckCircle2 } from "lucide-react";
import type { KimiImportResult } from "@/lib/contacts/kimi-contacts-adapter";

export function ImportStartedModal({
  onClose,
  result,
}: {
  onClose: () => void;
  result?: KimiImportResult | null;
}) {
  const hasErrors = (result?.errors?.length ?? 0) > 0;
  const title = result ? "Import complete" : "Import started";
  const summary = result
    ? `${result.created.toLocaleString()} created · ${result.updated.toLocaleString()} updated${
        result.suppressedSkipped
          ? ` · ${result.suppressedSkipped.toLocaleString()} skipped (opted out)`
          : ""
      }${hasErrors ? ` · ${result.errors.length.toLocaleString()} row errors` : ""}`
    : "We're working on importing the contacts in your file. You'll receive a notification once it's finished.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px] animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-2xl animate-in zoom-in-95 fade-in duration-150">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="mb-5 flex justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </span>
        </div>
        <h2 className="mb-2 font-display text-lg font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mx-auto mb-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">{summary}</p>
        {hasErrors && result ? (
          <div className="mx-auto mb-6 max-h-36 max-w-sm overflow-y-auto rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-[12px] text-muted-foreground">
            {result.errors.slice(0, 8).map((err) => (
              <p key={`${err.row}-${err.error}`} className="py-0.5">
                Row {err.row + 1}: {err.error}
              </p>
            ))}
            {result.errors.length > 8 ? (
              <p className="pt-1 text-[11px] text-muted-foreground/80">
                +{result.errors.length - 8} more row errors
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mb-7" />
        )}
        <button
          onClick={onClose}
          className="h-10 rounded-lg bg-primary px-10 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
