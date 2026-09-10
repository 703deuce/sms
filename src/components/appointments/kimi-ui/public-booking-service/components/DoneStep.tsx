import type { BookingType } from "../mock-data";
import type { ConfirmationResources } from "@/features/appointments/kimi/public/types";
import { Button } from "./ui";
import { formatSlotTime, formatFullDate } from "./utils";
import { CalendarPlus, Check, Clock, MapPin, Phone, Video } from "lucide-react";

export type ConfirmationState =
  | "confirmed"
  | "pending_approval"
  | "waitlist"
  | "registered";

function headlineForState(state: ConfirmationState): string {
  switch (state) {
    case "pending_approval":
      return "Request received";
    case "waitlist":
      return "You're on the waitlist";
    case "registered":
      return "You're registered";
    default:
      return "You're booked!";
  }
}

function subcopyForState(state: ConfirmationState): string {
  switch (state) {
    case "pending_approval":
      return "This appointment needs approval from the business. We'll notify you when it's confirmed.";
    case "waitlist":
      return "We'll contact you if a matching opening becomes available.";
    default:
      return "";
  }
}

function downloadIcs(input: {
  serviceName: string;
  startsAt: string;
  durationMinutes: number;
  location?: string;
  meetingLink?: string | null;
}) {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const description = [input.location, input.meetingLink].filter(Boolean).join("\n");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${input.serviceName}`,
    description ? `DESCRIPTION:${description}` : "",
    input.meetingLink ? `URL:${input.meetingLink}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "appointment.ics";
  a.click();
  URL.revokeObjectURL(url);
}

export function DoneStep({
  type,
  startsAt,
  timezone,
  durationMinutes,
  paid,
  confirmationState = "confirmed",
  workspace,
  confirmationResources,
  manageUrl,
  meetingLink,
  staffName,
  locationLabel,
  bookAgainUrl,
}: {
  type: BookingType;
  startsAt: string;
  timezone: string;
  durationMinutes?: number;
  paid?: boolean;
  confirmationState?: ConfirmationState;
  workspace: {
    name: string;
    businessPhone?: string;
    businessAddress?: string;
  };
  confirmationResources?: ConfirmationResources | null;
  manageUrl?: string | null;
  meetingLink?: string | null;
  staffName?: string | null;
  locationLabel?: string | null;
  bookAgainUrl?: string | null;
}) {
  const effectiveDuration = durationMinutes || type.durationMinutes;
  const subcopy = subcopyForState(confirmationState);
  const showWhen = Boolean(startsAt) && confirmationState !== "waitlist";
  const customHeadline = confirmationResources?.headline?.trim();
  const customBody = confirmationResources?.bodyHtml?.trim();

  return (
    <div className="fade-in text-center">
      <div
        className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ring-8 ${
          confirmationState === "pending_approval"
            ? "bg-amber-50 text-amber-600 ring-amber-50/60"
            : confirmationState === "waitlist"
              ? "bg-sky-50 text-sky-600 ring-sky-50/60"
              : "bg-emerald-50 text-emerald-600 ring-emerald-50/60"
        }`}
      >
        <Check className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
        {customHeadline || headlineForState(confirmationState)}
      </h1>
      {subcopy ? (
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{subcopy}</p>
      ) : null}
      {showWhen ? (
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {type.name} · {formatFullDate(startsAt, timezone)} at {formatSlotTime(startsAt, timezone)}
          {paid ? " · Payment received" : ""}
        </p>
      ) : confirmationState === "waitlist" && type.name ? (
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{type.name}</p>
      ) : null}

      <div className="mx-auto mt-5 max-w-sm rounded-xl border border-border bg-card p-4 text-left">
        <p className="text-sm font-semibold text-foreground">{workspace.name}</p>
        {workspace.businessAddress ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {workspace.businessAddress}
          </p>
        ) : null}
        {workspace.businessPhone ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {workspace.businessPhone}
          </p>
        ) : null}
        {staffName ? (
          <p className="mt-2 text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">Host:</span> {staffName}
          </p>
        ) : null}
        {locationLabel ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {locationLabel}
          </p>
        ) : null}
        {showWhen ? (
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {effectiveDuration} min
          </p>
        ) : null}
        {customBody ? (
          <div className="mt-3 border-t border-border pt-3">
            <p className="text-[12px] leading-relaxed text-muted-foreground">{customBody}</p>
          </div>
        ) : null}
        {confirmationState === "pending_approval" ? (
          <p className="mt-3 border-t border-border pt-3 text-[12px] font-medium text-amber-800">
            Status: Pending approval
          </p>
        ) : null}
      </div>

      <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
        {showWhen ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() =>
              downloadIcs({
                serviceName: type.name,
                startsAt,
                durationMinutes: effectiveDuration,
                location: locationLabel || undefined,
                meetingLink,
              })
            }
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar
          </Button>
        ) : null}
        {meetingLink ? (
          <a
            href={meetingLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/60"
          >
            <Video className="h-4 w-4" aria-hidden="true" /> Join meeting
          </a>
        ) : null}
        {manageUrl ? (
          <a
            href={manageUrl}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/60"
          >
            Manage booking
          </a>
        ) : confirmationResources?.ctaUrl ? (
          <a
            href={confirmationResources.ctaUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted/60"
          >
            {confirmationResources.ctaLabel || "View details"}
          </a>
        ) : null}
        {bookAgainUrl ? (
          <a
            href={bookAgainUrl}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg text-sm font-semibold text-primary hover:underline"
          >
            Book another
          </a>
        ) : null}
      </div>

      {!manageUrl && confirmationState === "confirmed" ? (
        <p className="mt-4 text-[12px] text-muted-foreground">
          Need to make a change? Check your confirmation message for reschedule and cancel links.
        </p>
      ) : null}
    </div>
  );
}
