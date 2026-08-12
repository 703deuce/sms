import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import type { RealtorLeadStatus } from "@/lib/realtor/types";
import { formatPhone } from "@/lib/utils";
import { ClickToCallButton } from "@/components/contacts/click-to-call-button";
import Link from "next/link";

export type LeadTimelineEvent = {
  id: string;
  at: string;
  title: string;
  detail?: string;
  href?: string;
  kind: "call" | "sms" | "ai" | "lead" | "appointment";
};

export type LeadAppointmentRow = {
  id: string;
  startsAt: string;
  serviceName: string;
};

export function RealtorLeadDetailView({
  leadId,
  name,
  status,
  intent,
  source,
  phone,
  email,
  assignedTo,
  needsAction,
  profileFields,
  appointments,
  timeline,
}: {
  leadId: string;
  name: string;
  status: RealtorLeadStatus;
  intent?: string;
  source?: string;
  phone: string;
  email?: string | null;
  assignedTo?: string;
  needsAction?: { title: string; detail: string };
  profileFields: Array<{ label: string; value: string }>;
  appointments: LeadAppointmentRow[];
  timeline: LeadTimelineEvent[];
}) {
  return (
    <div className="space-y-6">
      <Link href="/realtor/leads" className="text-sm font-medium text-primary">
        ← Back to Leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight">{name}</h1>
            <StatusChip status={status} />
          </div>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {intent || "Lead"}
            {source ? ` • ${source}` : ""}
          </p>
          {assignedTo ? (
            <p className="mt-1 text-sm text-muted-foreground">Assigned to {assignedTo}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>{formatPhone(phone)}</span>
            {email ? <span>{email}</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <ClickToCallButton phone={phone} />
          <Link
            href={`/inbox?contact=${leadId}`}
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
          >
            Text
          </Link>
          <Link
            href={`/send?contact=${leadId}`}
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
          >
            Email
          </Link>
          <Link
            href="/realtor/test"
            className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
          >
            Have Amy Call
          </Link>
        </div>
      </div>

      {needsAction ? (
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Needs / Next Action</p>
          <p className="mt-2 font-semibold">{needsAction.title}</p>
          <p className="text-sm text-muted-foreground">{needsAction.detail}</p>
          <div className="mt-3 flex gap-2">
            <Link
              href={`/phone?contact=${leadId}`}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              Call Now
            </Link>
            <Link
              href={`/inbox?contact=${leadId}`}
              className="inline-flex h-8 items-center rounded-lg border border-border px-3 text-xs font-medium"
            >
              Open conversation
            </Link>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-4">
            <CardTitle className="mb-3 text-base">Buyer Profile</CardTitle>
            {profileFields.length ? (
              <dl className="space-y-2 text-sm">
                {profileFields.map((field) => (
                  <div key={field.label} className="flex justify-between gap-4 border-b py-2 last:border-0">
                    <dt className="text-muted-foreground">{field.label}</dt>
                    <dd className="text-right font-medium">{field.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Amy will populate qualification fields as the conversation progresses.
              </p>
            )}
          </Card>

          <Card className="p-4">
            <CardTitle className="mb-3 text-base">Appointments</CardTitle>
            {appointments.length ? (
              <ul className="space-y-3 text-sm">
                {appointments.map((appt) => (
                  <li key={appt.id} className="border-b pb-2 last:border-0">
                    <p className="font-medium">{appt.serviceName}</p>
                    <p className="text-muted-foreground">
                      {new Date(appt.startsAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No appointments scheduled.</p>
            )}
          </Card>
        </div>

        <Card className="p-4">
          <CardTitle className="mb-3 text-base">Activity</CardTitle>
          <ul className="space-y-4">
            {timeline.length ? (
              timeline.map((event) => (
                <li key={event.id} className="border-b pb-3 last:border-0">
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.at).toLocaleString()}
                  </p>
                  {event.href ? (
                    <Link href={event.href} className="font-medium text-primary hover:underline">
                      {event.title}
                    </Link>
                  ) : (
                    <p className="font-medium">{event.title}</p>
                  )}
                  {event.detail ? (
                    <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
                  ) : null}
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">No activity yet.</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
