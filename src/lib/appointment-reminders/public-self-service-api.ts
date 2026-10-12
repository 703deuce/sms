import "server-only";

import { assessPublicSelfServiceEligibility } from "@/lib/appointment-reminders/public-self-service-guard";

export function publicSelfServiceFieldsForAppointment(row: {
  status: string;
  startsAt: Date;
  endsAt?: Date | null;
}) {
  const gate = assessPublicSelfServiceEligibility({
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  });
  return {
    selfServiceBlocked: !gate.allowed,
    selfServiceBlockReason: gate.allowed ? undefined : gate.reason,
  };
}

export function assertPublicSelfServiceAllowed(row: {
  status: string;
  startsAt: Date;
  endsAt?: Date | null;
}): { ok: true } | { ok: false; message: string } {
  const gate = assessPublicSelfServiceEligibility(row);
  if (gate.allowed) return { ok: true };
  const messages: Record<string, string> = {
    canceled: "This appointment was canceled and can no longer be changed online.",
    completed: "This appointment is complete and can no longer be changed online.",
    past: "This appointment has already passed.",
    not_scheduled: "This appointment is not available for self-service changes.",
  };
  return { ok: false, message: messages[gate.reason] || "Changes are not available." };
}
