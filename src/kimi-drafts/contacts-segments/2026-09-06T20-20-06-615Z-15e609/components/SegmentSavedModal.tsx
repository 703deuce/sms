"use client";
import { CheckCircle2, Eye, ArrowRight } from "lucide-react";
import { Segment } from "../mock-data";

export default function SegmentSavedModal({
  segment,
  onViewContacts,
  onViewSegments,
}: {
  segment: Segment;
  onViewContacts: () => void;
  onViewSegments: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onViewSegments} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="seg-saved-title"
        className="relative seg-card rounded-xl border border-border bg-card w-full max-w-md p-6 seg-fade text-center"
      >
        <span className="mx-auto mb-3 h-11 w-11 rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <h3 id="seg-saved-title" className="font-display text-lg font-semibold tracking-tight text-foreground">
          Segment saved
        </h3>
        <p className="text-sm text-muted-foreground mt-1.5">
          <span className="font-medium text-foreground">{segment.name}</span> now matches{" "}
          <span className="font-medium text-foreground tabular-nums">{segment.contacts.toLocaleString()}</span> contacts.
          Membership will update automatically as contacts change.
        </p>
        <div className="flex flex-col gap-2 mt-5">
          <button
            onClick={onViewContacts}
            className="seg-btn-primary h-9 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98]"
          >
            <Eye className="h-4 w-4" /> View Contacts
          </button>
          <button
            onClick={onViewSegments}
            className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground flex items-center justify-center gap-2 transition-colors"
          >
            Back to Segments <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
