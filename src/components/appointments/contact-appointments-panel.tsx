"use client";

import { AppointmentStatusBadge, formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { StatusChip } from "@/components/ui/status-chip";
import { cn } from "@/lib/utils";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ContactAppointment = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  status: string;
  isUpcoming: boolean;
};

function SectionLabel({
  children,
  count,
}: {
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </h3>
      {typeof count === "number" && count > 0 ? (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </div>
  );
}

function InlineEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
      <p className="text-[13px] text-muted-foreground">{children}</p>
    </div>
  );
}

function AppointmentRow({
  appt,
  upcoming,
}: {
  appt: ContactAppointment;
  upcoming: boolean;
}) {
  return (
    <Link
      href={`/appointments/${appt.id}`}
      className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3.5 py-2.5 no-underline transition-all duration-150 hover:border-primary/30 hover:bg-muted/20 hover:shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            upcoming ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {appt.serviceName || "Appointment"}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {formatAppointmentWhen(appt.startsAt, null)}
          </p>
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-2">
        {upcoming ? (
          <AppointmentStatusBadge status={appt.status} />
        ) : (
          <StatusChip status={appt.status} />
        )}
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </Link>
  );
}

export function ContactAppointmentsPanel({ contactId }: { contactId: string }) {
  const [upcoming, setUpcoming] = useState<ContactAppointment[]>([]);
  const [past, setPast] = useState<ContactAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`/api/contacts/${contactId}/crm-context`)
      .then((r) => r.json())
      .then((json) => {
        setUpcoming(json.data?.upcomingAppointments || []);
        setPast(json.data?.pastAppointments || []);
      })
      .finally(() => setLoading(false));
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 rounded-lg border border-border px-3.5 py-3"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-2.5 w-36 animate-pulse rounded-full bg-muted" />
                <div className="h-2.5 w-24 animate-pulse rounded-full bg-muted" />
              </div>
            </div>
            <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <SectionLabel count={upcoming.length}>Upcoming</SectionLabel>
        {upcoming.length === 0 ? (
          <InlineEmpty>No upcoming appointments.</InlineEmpty>
        ) : (
          <div className="mt-2 space-y-2">
            {upcoming.map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} upcoming />
            ))}
          </div>
        )}
      </div>
      <div>
        <SectionLabel count={past.length}>History</SectionLabel>
        {past.length === 0 ? (
          <InlineEmpty>No past appointments.</InlineEmpty>
        ) : (
          <div className="mt-2 space-y-2">
            {past.slice(0, 8).map((appt) => (
              <AppointmentRow key={appt.id} appt={appt} upcoming={false} />
            ))}
          </div>
        )}
      </div>
      <Link
        href="/appointments"
        className="inline-flex items-center gap-1 text-[13px] font-medium text-primary transition-colors hover:text-primary-hover"
      >
        View all appointments
        <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
