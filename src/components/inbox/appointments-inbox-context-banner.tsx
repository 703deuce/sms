"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";
import type { Conversation } from "@/lib/inbox/conversation-types";

type Props = {
  contactId?: string | null;
  appointmentContext: NonNullable<Conversation["appointmentContext"]>;
};

function fmtWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Light appointment context for Appointments inbox threads (canonical contact + appointment). */
export function AppointmentsInboxContextBanner({ contactId, appointmentContext }: Props) {
  const when = fmtWhen(appointmentContext.startsAt);
  const service = appointmentContext.serviceName || "Appointment";

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-muted/40 px-4 py-2.5"
      role="status"
    >
      <div className="flex min-w-0 items-start gap-2 text-[13px] text-foreground">
        <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium text-foreground">Next appointment</p>
          <p className="text-[12px] text-muted-foreground">
            {when} · {service}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[12px] font-semibold">
        {contactId ? (
          <Link href={`/contacts/${contactId}`} className="text-foreground hover:underline">
            Open client
          </Link>
        ) : null}
        <Link href={`/appointments/${appointmentContext.id}`} className="text-foreground hover:underline">
          Open appointment
        </Link>
      </div>
    </div>
  );
}
