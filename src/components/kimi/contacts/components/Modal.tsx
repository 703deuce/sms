"use client";
import { X, CheckCircle2 } from "lucide-react";

export function ImportStartedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md p-8 relative text-center border border-border">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1 transition-colors"
        >
          <X className="w-4.5 h-4.5 w-4 h-4" />
        </button>
        <div className="flex justify-center mb-5">
          <span className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </span>
        </div>
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-2">Import Started</h2>
        <p className="text-[13px] text-muted-foreground leading-relaxed mb-7 max-w-xs mx-auto">
          We're working on importing the contacts in your file. You'll receive a notification once finished.
        </p>
        <button
          onClick={onClose}
          className="kc-btn-primary px-10 h-10 text-[13px]"
        >
          Close
        </button>
      </div>
    </div>
  );
}
