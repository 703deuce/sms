import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import type { ExistingAppointment } from "../appointment-management-types";
import { getGoogleCalendarEventRaw } from "./google-events-api";

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
    const status = (raw as { status?: string }).status;
    if (status === "cancelled") {
      return { ok: false, reason: "cancelled", message: "event already cancelled" };
    }
    const start = (raw as { start?: { dateTime?: string; date?: string } }).start;
    const end = (raw as { end?: { dateTime?: string; date?: string } }).end;
    const startRaw = start?.dateTime || start?.date;
    const endRaw = end?.dateTime || end?.date;
    if (!startRaw || !endRaw) {
      return { ok: false, reason: "error", message: "event missing start/end" };
    }
    const isAllDay = Boolean(start?.date && !start?.dateTime);
    const startUtc = new Date(isAllDay ? `${startRaw}T00:00:00Z` : startRaw).toISOString();
    const endUtc = new Date(isAllDay ? `${endRaw}T00:00:00Z` : endRaw).toISOString();
    return { ok: true, startUtc, endUtc };
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
