import type { BookingType } from "../mock-data";
import { workspace, confirmationResource } from "../mock-data";
import { Button } from "./ui";
import { formatSlotTime, formatFullDate } from "./utils";
import { CalendarPlus, Check, MapPin, Phone } from "lucide-react";

export function DoneStep({
  type,
  startsAt,
  timezone,
  paid,
}: {
  type: BookingType;
  startsAt: string;
  timezone: string;
  paid: boolean;
}) {
  return (
    <div className="fade-in text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
        <Check className="h-7 w-7" />
      </div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
        You're booked!
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        {type.name} · {formatFullDate(startsAt, timezone)} at {formatSlotTime(startsAt, timezone)}
        {paid ? " · Payment received" : ""}
      </p>

      <div className="mx-auto mt-5 max-w-sm rounded-xl border border-border bg-card p-4 text-left">
        <p className="text-sm font-semibold text-foreground">{workspace.name}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 shrink-0" /> {workspace.businessAddress}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Phone className="h-3.5 w-3.5 shrink-0" /> {workspace.businessPhone}
        </p>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-[13px] font-semibold text-foreground">{confirmationResource.headline}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{confirmationResource.bodyHtml}</p>
        </div>
      </div>

      <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
        <Button size="lg" className="w-full">
          <CalendarPlus className="h-4 w-4" /> Add to calendar
        </Button>
        <a
          href={confirmationResource.ctaUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/60"
        >
          {confirmationResource.ctaLabel}
        </a>
      </div>

      <p className="mt-4 text-[12px] text-muted-foreground">
        Need to make a change? Check your confirmation text for reschedule and cancel links.
      </p>
    </div>
  );
}
