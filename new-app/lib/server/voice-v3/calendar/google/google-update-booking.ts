import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import {
  getGoogleCalendarEventRaw,
  replaceGoogleCalendarEvent,
} from "./google-events-api";
import { canonicalUtcIntervalToGoogleTimedEventBounds } from "./google-datetime-adapter";

export type GoogleUpdateBookingRequest = {
  connectionId: string;
  providerEventId: string;
  providerCalendarId: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
};

export type GoogleUpdateBookingResult =
  | { ok: true; providerEventId: string; durationMs: number }
  | {
      ok: false;
      reason: "GOOGLE_AUTH_FAILED" | "GOOGLE_TEMPORARY_FAILURE" | "BOOKING_OUTCOME_UNKNOWN";
      message: string;
      durationMs: number;
      outcomeUncertain?: boolean;
    };

function sanitizeEventForUpdate(
  raw: Record<string, unknown>,
  patch: { startUtc: string; endUtc: string; timezone: string },
): Record<string, unknown> | null {
  const bounds = canonicalUtcIntervalToGoogleTimedEventBounds({
    startUtc: patch.startUtc,
    endUtc: patch.endUtc,
    timeZone: patch.timezone,
  });
  if (!bounds) return null;
  const copy = { ...raw };
  for (const key of ["kind", "etag", "id", "htmlLink", "created", "updated", "creator", "organizer"]) {
    delete copy[key];
  }
  copy.start = bounds.start;
  copy.end = bounds.end;
  return copy;
}

export async function executeGoogleUpdateBooking(
  request: GoogleUpdateBookingRequest,
  calendarConfig: CalendarConfig,
  timeoutMs = 15_000,
): Promise<GoogleUpdateBookingResult> {
  const started = Date.now();
  try {
    if (!hasOAuthTokens(calendarConfig)) {
      return {
        ok: false,
        reason: "GOOGLE_AUTH_FAILED",
        message: "missing tokens",
        durationMs: Date.now() - started,
      };
    }
    const token = await getValidAccessToken(request.connectionId, "google", calendarConfig);
    const existing = await getGoogleCalendarEventRaw({
      accessToken: token,
      calendarId: request.providerCalendarId,
      eventId: request.providerEventId,
    });
    if (!existing) {
      return {
        ok: false,
        reason: "GOOGLE_TEMPORARY_FAILURE",
        message: "Event not found",
        durationMs: Date.now() - started,
      };
    }
    const body = sanitizeEventForUpdate(existing as Record<string, unknown>, {
      startUtc: request.startUtc,
      endUtc: request.endUtc,
      timezone: request.timezone,
    });
    if (!body) {
      return {
        ok: false,
        reason: "GOOGLE_TEMPORARY_FAILURE",
        message: "Invalid reschedule interval",
        durationMs: Date.now() - started,
      };
    }

    await Promise.race([
      replaceGoogleCalendarEvent({
        accessToken: token,
        calendarId: request.providerCalendarId,
        eventId: request.providerEventId,
        sendUpdates: "all",
        body,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("update timeout")), timeoutMs),
      ),
    ]);

    return {
      ok: true,
      providerEventId: request.providerEventId,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("econnreset")) {
      return {
        ok: false,
        reason: "BOOKING_OUTCOME_UNKNOWN",
        message,
        durationMs: Date.now() - started,
        outcomeUncertain: true,
      };
    }
    if (lower.includes("401") || lower.includes("token")) {
      return {
        ok: false,
        reason: "GOOGLE_AUTH_FAILED",
        message,
        durationMs: Date.now() - started,
      };
    }
    return {
      ok: false,
      reason: "GOOGLE_TEMPORARY_FAILURE",
      message,
      durationMs: Date.now() - started,
    };
  }
}
