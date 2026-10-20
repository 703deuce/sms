import "server-only";

import type { ExistingAppointment } from "../appointment-management-types";
import { fetchMicrosoftEventById } from "./microsoft-get-event";
import type { CalendarConfig } from "@/lib/voice/calendar/providers";

export type MicrosoftAppointmentValidation =
  | { ok: true; startUtc: string; endUtc: string }
  | { ok: false; reason: "not_found" | "cancelled" | "auth" | "error"; message: string };

export async function validateMicrosoftAppointmentBeforeMutation(input: {
  appointment: ExistingAppointment;
  connectionId: string;
  calendarConfig: CalendarConfig;
}): Promise<MicrosoftAppointmentValidation> {
  if (
    input.appointment.providerConnectionId &&
    input.appointment.providerConnectionId !== input.connectionId
  ) {
    return { ok: false, reason: "error", message: "connection mismatch" };
  }

  const snap = await fetchMicrosoftEventById({
    connectionId: input.connectionId,
    calendarConfig: input.calendarConfig,
    providerEventId: input.appointment.providerEventId,
  });
  if (!snap.ok) {
    return {
      ok: false,
      reason: snap.reason === "not_found" ? "not_found" : snap.reason === "auth" ? "auth" : "error",
      message: snap.message,
    };
  }
  if (snap.event.isCancelled) {
    return { ok: false, reason: "cancelled", message: "event already cancelled" };
  }
  return { ok: true, startUtc: snap.event.startUtc, endUtc: snap.event.endUtc };
}
