"use client";

import { BookingType, staffOptions } from "../mock-data";
import { Clock, MapPin, Sparkles, Users, ChevronRight, CalendarOff } from "lucide-react";

export function ServiceStep({
  types,
  onPick,
  onAi,
  onWaitlist,
}: {
  types: BookingType[];
  onPick: (t: BookingType) => void;
  onAi: () => void;
  onWaitlist: () => void;
}) {
  return (
    <div className="tv-fade-up">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground sm:text-[26px]">
            Book an appointment
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Choose a service below — it only takes a minute. No account required.
          </p>
        </div>

        <div className="space-y-3" role="list" aria-label="Available services">
          {types.map((t) => {
            const assignedStaff = (t.staffIds || [])
              .map((id) => staffOptions.find((s) => s.id === id)?.name)
              .filter(Boolean);
            return (
              <button
                key={t.id}
                role="listitem"
                onClick={() => onPick(t)}
                className="group w-full rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-[15px] font-semibold text-foreground">{t.name}</h2>
                      {t.priceDisplay ? (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                          {t.priceDisplay}
                        </span>
                      ) : null}
                    </div>
                    {t.description ? (
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{t.description}</p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" /> {t.durationMinutes} min
                      </span>
                      {t.location ? (
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5" /> {t.location}
                        </span>
                      ) : null}
                      {t.groupBooking?.enabled ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> Up to {t.groupBooking.maxAttendees} attendees
                        </span>
                      ) : null}
                      {assignedStaff.length > 0 ? (
                        <span className="inline-flex items-center gap-1.5">
                          with {assignedStaff.join(" or ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={onAi}
            className="flex items-center gap-3 rounded-xl border border-primary/25 p-4 text-left transition-colors hover:bg-accent/60"
            style={{ background: "linear-gradient(135deg, rgba(67,56,202,0.06), rgba(67,56,202,0.02))" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-foreground">Book with AI assistant</span>
              <span className="block text-[12px] text-muted-foreground">Describe what you need in plain words</span>
            </span>
          </button>
          <button
            onClick={onWaitlist}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <CalendarOff className="h-4.5 w-4.5" />
            </span>
            <span>
              <span className="block text-[13px] font-semibold text-foreground">No time that works?</span>
              <span className="block text-[12px] text-muted-foreground">Join the waitlist for openings</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
