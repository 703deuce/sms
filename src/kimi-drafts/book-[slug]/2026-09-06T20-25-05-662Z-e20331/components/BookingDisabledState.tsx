"use client";

import { CalendarOff, Phone } from "lucide-react";
import { workspace } from "../mock-data";

export function BookingDisabledState() {
  return (
    <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <CalendarOff className="h-5 w-5" />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold text-foreground">Online booking is unavailable</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {workspace.name} has temporarily disabled online booking. Please contact the business directly to schedule.
      </p>
      <a
        href={`tel:${workspace.phone.replace(/\D/g, "")}`}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm"
      >
        <Phone className="h-4 w-4" />
        Call {workspace.phone}
      </a>
    </div>
  );
}
