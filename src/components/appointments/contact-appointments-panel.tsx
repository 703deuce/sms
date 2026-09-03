"use client";

import { AppointmentStatusBadge, formatAppointmentWhen } from "@/components/appointments/appointment-ui";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type ContactAppointment = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  status: string;
  isUpcoming: boolean;
};

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

  if (loading) return <p className="text-sm text-muted-foreground">Loading appointments…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Upcoming</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No upcoming appointments.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {upcoming.map((appt) => (
              <Link
                key={appt.id}
                href={`/appointments/${appt.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 no-underline hover:bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">{appt.serviceName || "Appointment"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAppointmentWhen(appt.startsAt, null)}
                  </p>
                </div>
                <AppointmentStatusBadge status={appt.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-foreground">History</h3>
        {past.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No past appointments.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {past.slice(0, 8).map((appt) => (
              <Link
                key={appt.id}
                href={`/appointments/${appt.id}`}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 no-underline hover:bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium">{appt.serviceName || "Appointment"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatAppointmentWhen(appt.startsAt, null)}
                  </p>
                </div>
                <StatusChip status={appt.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
      <Link href="/appointments" className="text-sm font-medium text-primary hover:underline">
        View all appointments →
      </Link>
    </div>
  );
}
