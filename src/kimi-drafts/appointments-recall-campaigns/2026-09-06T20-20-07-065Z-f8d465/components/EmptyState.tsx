"use client";

import { CalendarClock, Plus } from "lucide-react";

export function EmptyState({
  onCreate,
  acting,
}: {
  onCreate: () => void;
  acting: boolean;
}) {
  return (
    <div className="surface rounded-xl bg-card px-6 py-14 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10">
        <CalendarClock className="h-6 w-6 text-[hsl(var(--primary))]" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-base font-semibold tracking-tight">
        No recall campaigns yet
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        Recall campaigns re-engage customers who haven&apos;t booked in a while. Choose
        how long it&apos;s been since their last visit, pick SMS or email, and Transovo
        sends only to contacts with consent and no upcoming appointment.
      </p>
      <button
        type="button"
        onClick={onCreate}
        disabled={acting}
        className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[hsl(var(--primary-hover))] disabled:opacity-50"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create your first campaign
      </button>
    </div>
  );
}
