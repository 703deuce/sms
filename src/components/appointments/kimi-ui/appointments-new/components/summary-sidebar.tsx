"use client";

import { Bell, CalendarCheck2, Clock, CreditCard, Globe, MapPin, User, Users } from "lucide-react";
import { workspace } from "../types";

export function SummarySidebar({
  typeName,
  duration,
  startsAt,
  firstName,
  lastName,
  phone,
  smsConsent,
  staffName,
  locationName,
  priceCents,
}: {
  typeName?: string;
  duration?: number;
  startsAt?: string;
  firstName: string;
  lastName: string;
  phone: string;
  smsConsent: boolean;
  staffName?: string;
  locationName?: string;
  priceCents?: number | null;
}) {
  const dateLabel = startsAt
    ? new Date(startsAt).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;
  const timeLabel = startsAt
    ? new Date(startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;
  const customerName = [firstName, lastName].filter(Boolean).join(" ");

  const rows: { icon: React.ReactNode; label: string; value: string; ready: boolean }[] = [
    {
      icon: <CalendarCheck2 className="h-3.5 w-3.5" />,
      label: "Appointment type",
      value: typeName || "Not selected",
      ready: !!typeName,
    },
    {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: "Date & time",
      value: dateLabel ? `${dateLabel} · ${timeLabel}` : "No time selected",
      ready: !!startsAt,
    },
    {
      icon: <User className="h-3.5 w-3.5" />,
      label: "Customer",
      value: customerName || "Not entered",
      ready: !!customerName,
    },
    ...(staffName
      ? [{
          icon: <Users className="h-3.5 w-3.5" />,
          label: "Staff",
          value: staffName,
          ready: true,
        }]
      : []),
    ...(locationName
      ? [{
          icon: <MapPin className="h-3.5 w-3.5" />,
          label: "Location",
          value: locationName,
          ready: true,
        }]
      : []),
    ...(priceCents != null && priceCents > 0
      ? [{
          icon: <CreditCard className="h-3.5 w-3.5" />,
          label: "Price",
          value: `$${(priceCents / 100).toFixed(2)}`,
          ready: true,
        }]
      : []),
    {
      icon: <Bell className="h-3.5 w-3.5" />,
      label: "Reminders",
      value: smsConsent ? workspace.reminderSequence : "Disabled for this appointment",
      ready: smsConsent,
    },
  ];

  return (
    <aside className="space-y-4 lg:sticky lg:top-6">
      <div className="surface rounded-xl bg-[hsl(var(--card))] p-5">
        <h3 className="font-display text-sm font-semibold tracking-tight text-[hsl(var(--foreground))]">
          Summary
        </h3>
        <div className="mt-4 space-y-3.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-2.5">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                  row.ready
                    ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
                }`}
              >
                {row.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
                  {row.label}
                </p>
                <p
                  className={`mt-0.5 truncate text-[13px] font-medium ${
                    row.ready ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"
                  }`}
                >
                  {row.value}
                </p>
              </div>
            </div>
          ))}
        </div>
        {duration ? (
          <p className="mt-4 border-t border-[hsl(var(--border))] pt-3 text-xs text-[hsl(var(--muted-foreground))]">
            Duration: <span className="font-semibold text-[hsl(var(--foreground))]">{duration} minutes</span>
          </p>
        ) : null}
      </div>

      <div className="surface rounded-xl bg-[hsl(var(--card))] p-5">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            Timezone
          </p>
        </div>
        <p className="mt-1.5 text-[13px] font-medium text-[hsl(var(--foreground))]">
          {workspace.timezoneLabel}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
          All times shown in your workspace timezone ({workspace.timezone}).
        </p>
      </div>

      {phone && smsConsent ? (
        <div className="rounded-xl border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.05)] p-4">
          <p className="text-xs font-semibold text-[hsl(var(--success))]">SMS reminders enabled</p>
          <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            A confirmation and reminders will be sent to {phone} using the {workspace.reminderSequence} sequence.
          </p>
        </div>
      ) : null}
    </aside>
  );
}
