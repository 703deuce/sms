"use client";

import { UserCheck, X } from "lucide-react";

export function ReturningVisitorBanner({
  name,
  onClear,
}: {
  name: string;
  onClear: () => void;
}) {
  return (
    <div
      className="mb-5 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
      role="status"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <UserCheck className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">Welcome back, {name}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
          We prefilled your contact details from a previous visit. You can edit them before booking.
        </p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Clear prefilled details"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
