"use client";

import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusChip } from "@/components/ui/status-chip";
import Link from "next/link";
import { useEffect, useState } from "react";

type Appt = {
  id: string;
  serviceName: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  contactId: string | null;
  externalId: string | null;
  provider: string | null;
  inviteeName: string | null;
  inviteeEmail: string | null;
};

export function AppointmentsClient() {
  const [rows, setRows] = useState<Appt[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/integrations/native/appointments")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error);
        else setRows(j.data?.appointments || []);
      })
      .catch(() => setError("Failed to load appointments"));
  }, []);

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Calendly and HighLevel appointments synced for reminders, call context, and automations — not a full calendar product."
      />
      <div className="mb-4 text-sm">
        <Link href="/integrations/native" className="underline">
          ← Native integrations
        </Link>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="space-y-3">
        {rows.map((a) => (
          <Card key={a.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{a.serviceName || "Appointment"}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {a.provider || "calendar"} · {new Date(a.startsAt).toLocaleString()}
                  {a.endsAt ? ` – ${new Date(a.endsAt).toLocaleString()}` : ""}
                </p>
              </div>
              <StatusChip status={a.status} />
            </div>
            <p className="mt-2 text-sm">
              {a.inviteeName || "Invitee"}
              {a.inviteeEmail ? ` · ${a.inviteeEmail}` : ""}
            </p>
            <div className="mt-3 flex gap-3 text-sm">
              {a.contactId ? (
                <Link href={`/contacts/${a.contactId}`} className="underline">
                  Open contact
                </Link>
              ) : null}
            </div>
          </Card>
        ))}
        {!rows.length && !error ? (
          <p className="text-sm text-muted-foreground">
            No synced appointments yet. Connect Calendly or HighLevel and sync.
          </p>
        ) : null}
      </div>
    </div>
  );
}
