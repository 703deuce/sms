"use client";
import { X, CheckCircle2 } from "lucide-react";

export function ImportStartedModal({ onClose }: { onClose: () => void }) {
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
        <h2 className="mb-2 font-display text-lg font-semibold tracking-tight text-foreground">Import Started</h2>
        <p className="mx-auto mb-7 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          We're working on importing the contacts in your file. You'll receive a notification once it's finished.
        </p>
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
