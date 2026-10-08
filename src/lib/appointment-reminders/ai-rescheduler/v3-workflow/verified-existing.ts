import "server-only";

import { getPrisma } from "@/lib/db";
import type { ExistingAppointment } from "@/lib/voice-v3/calendar/appointment-management-types";
import { providerRefFromAppointment, toExistingMicrosoftAppointment } from "../provider-mutations";
import type { ArSmsReplySession } from "@/lib/domain";

/**
 * AR session binding → Voice V3 verifiedExisting (no find_appointment).
 */
export async function loadVerifiedExistingForArSession(input: {
  workspaceId: string;
  session: Pick<
    ArSmsReplySession,
    | "appointmentId"
    | "contactId"
    | "calendarConnectionId"
    | "providerEventId"
    | "providerCalendarId"
    | "calendarProvider"
  >;
}): Promise<
  | { ok: true; appointment: ExistingAppointment; provider: "google" | "microsoft" }
  | { ok: false; reason: string }
> {
  const prisma = getPrisma();
  const row = await prisma.voiceAppointment.findFirst({
    where: {
      id: input.session.appointmentId,
      workspaceId: input.workspaceId,
      contactId: input.session.contactId,
    },
  });
  if (!row) return { ok: false, reason: "appointment_not_found" };

  const ref = providerRefFromAppointment(row);
  if (!ref) return { ok: false, reason: "no_provider_ref" };

  if (input.session.calendarConnectionId && ref.connectionId !== input.session.calendarConnectionId) {
    return { ok: false, reason: "calendar_connection_mismatch" };
  }
  if (input.session.providerEventId && ref.providerEventId !== input.session.providerEventId) {
    return { ok: false, reason: "provider_event_mismatch" };
  }

  if (ref.provider === "microsoft") {
    return {
      ok: true,
      provider: "microsoft",
      appointment: toExistingMicrosoftAppointment(row, ref),
    };
  }

  const durationMinutes = Math.max(
    1,
    Math.round((row.endsAt.getTime() - row.startsAt.getTime()) / 60_000),
  );
  const existing: ExistingAppointment = {
    internalBookingId: row.id,
    provider: "microsoft",
    providerEventId: ref.providerEventId,
    providerCalendarId: ref.providerCalendarId || "",
    providerConnectionId: ref.connectionId,
    startUtc: row.startsAt.toISOString(),
    endUtc: row.endsAt.toISOString(),
    localStart: row.startsAt.toISOString(),
    localEnd: row.endsAt.toISOString(),
    timezone: ref.timezone,
    customerIdentity: {},
    durationMinutes,
    status: "ACTIVE",
  };

  return { ok: true, provider: "google", appointment: existing };
}
