"use client";
import { X, CheckCircle2 } from "lucide-react";

export function ImportStartedModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md p-8 relative text-center">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <div className="flex justify-center mb-4">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Import Started</h2>
        <p className="text-sm text-muted-foreground mb-6">
          We're working on importing the contacts in your file. You'll receive a notification once finished.
        </p>
        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
