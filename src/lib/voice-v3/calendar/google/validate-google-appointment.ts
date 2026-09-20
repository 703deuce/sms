import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import type { ExistingAppointment } from "../appointment-management-types";
import { getGoogleCalendarEventRaw } from "./google-events-api";
import { googleWireToUtcInstant } from "./google-datetime-adapter";

export type GoogleAppointmentValidation =
  | { ok: true; startUtc: string; endUtc: string }
  | { ok: false; reason: "not_found" | "cancelled" | "auth" | "error"; message: string };

export async function validateGoogleAppointmentBeforeMutation(input: {
  appointment: ExistingAppointment;
  connectionId: string;
  calendarConfig: CalendarConfig;
}): Promise<GoogleAppointmentValidation> {
  if (
    input.appointment.providerConnectionId &&
    input.appointment.providerConnectionId !== input.connectionId
  ) {
    return { ok: false, reason: "error", message: "connection mismatch" };
  }

  if (!hasOAuthTokens(input.calendarConfig)) {
    return { ok: false, reason: "auth", message: "Google OAuth tokens missing" };
  }

  try {
    const token = await getValidAccessToken(
      input.connectionId,
      "google",
      input.calendarConfig,
    );
    const raw = await getGoogleCalendarEventRaw({
      accessToken: token,
      calendarId: input.appointment.providerCalendarId,
      eventId: input.appointment.providerEventId,
    });
    if (!raw) {
      return { ok: false, reason: "not_found", message: "event not found" };
    }
    const event = raw as {
      status?: string;
      start?: { dateTime?: string; date?: string; timeZone?: string };
      end?: { dateTime?: string; date?: string; timeZone?: string };
    };
    if (event.status === "cancelled") {
      return { ok: false, reason: "cancelled", message: "event already cancelled" };
    }
    const tz =
      event.start?.timeZone ||
      event.end?.timeZone ||
      input.calendarConfig.mailboxTimezone ||
      "UTC";
    const startInstant = event.start
      ? googleWireToUtcInstant(event.start, tz)
      : null;
    const endInstant = event.end ? googleWireToUtcInstant(event.end, tz) : null;
    if (!startInstant || !endInstant) {
      return { ok: false, reason: "error", message: "event missing start/end" };
    }
    return {
      ok: true,
      startUtc: startInstant.toISOString(),
      endUtc: endInstant.toISOString(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.toLowerCase().includes("token")) {
      return { ok: false, reason: "auth", message };
    }
    if (message.includes("404")) {
      return { ok: false, reason: "not_found", message };
    }
    return { ok: false, reason: "error", message };
  }
}
