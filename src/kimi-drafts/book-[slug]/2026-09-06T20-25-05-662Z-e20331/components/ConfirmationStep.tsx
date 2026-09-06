"use client";

import { BookingType, workspace } from "../mock-data";
import { CalendarPlus, Check, Clock, MapPin, Users } from "lucide-react";

export function ConfirmationStep({
  type,
  startsAt,
  firstName,
  email,
  attendeeCount,
  recurringMode,
  recurringOccurrences,
  paidAmount,
  onBookAnother,
}: {
  type: BookingType;
  startsAt: string;
  firstName: string;
  email: string;
  attendeeCount: number;
  recurringMode: string;
  recurringOccurrences: number;
  paidAmount?: string;
  onBookAnother: () => void;
}) {
  const when = new Date(startsAt);
  const dateLabel = when.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const timeLabel = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const icsHref = `data:text/calendar;charset=utf8,${encodeURIComponent(
    ["BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT", `SUMMARY:${type.name} — ${workspace.name}`, `DTSTART:${when.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`, `DURATION:PT${type.durationMinutes}M`, "END:VEVENT", "END:VCALENDAR"].join("\r\n"),
  )}`;

  return (
    <div className="tv-fade-up mx-auto max-w-lg">
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm sm:p-8">
        <div
          className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"
          style={{ boxShadow: "0 0 0 10px rgba(16,185,129,0.08)" }}
        >
          <Check className="h-7 w-7" />
        </div>
        <h1 className="font-display text-[20px] font-semibold tracking-tight text-foreground">
          You're booked{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          A confirmation is on its way to <span className="font-medium text-foreground">{email}</span>.
          {recurringMode !== "once" ? ` This repeats ${recurringMode} for ${recurringOccurrences} occurrences.` : ""}
        </p>

        <div className="mt-6 space-y-3 rounded-xl bg-muted/50 p-5 text-left">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-foreground">{type.name}</p>
              <p className="text-[12px] text-muted-foreground">{dateLabel} · {timeLabel} ({workspace.timezoneLabel})</p>
            </div>
          </div>
          {type.location ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-medium text-foreground">{type.location}</p>
                <p className="text-[12px] text-muted-foreground">{workspace.address}</p>
              </div>
            </div>
          ) : null}
          {attendeeCount > 1 ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </span>
              <p className="text-[13px] font-medium text-foreground">{attendeeCount} attendees</p>
            </div>
          ) : null}
          {paidAmount ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
              Payment received — ${paidAmount}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
          <a
            href={icsHref}
            download="appointment.ics"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground shadow-sm transition-colors hover:bg-muted/60"
          >
            <CalendarPlus className="h-4 w-4" /> Add to calendar
          </a>
          <button
            onClick={onBookAnother}
            className="rounded-lg px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98]"
            style={{ background: "var(--primary)" }}
          >
            Book another appointment
          </button>
        </div>

        <p className="mt-5 text-[12px] text-muted-foreground">
          Need to make a change? Use the reschedule or cancel link in your confirmation message, or call{" "}
          <span className="font-medium text-foreground">{workspace.phone}</span>.
        </p>
      </div>
    </div>
  );
}
