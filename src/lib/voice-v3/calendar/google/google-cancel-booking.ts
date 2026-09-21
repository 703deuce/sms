import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import { deleteGoogleCalendarEvent } from "./google-events-api";

export type GoogleCancelBookingResult =
  | { ok: true; durationMs: number }
  | {
      ok: false;
      reason: "GOOGLE_AUTH_FAILED" | "GOOGLE_TEMPORARY_FAILURE";
      message: string;
      durationMs: number;
    };

export async function executeGoogleCancelBooking(input: {
  connectionId: string;
  providerEventId: string;
  providerCalendarId: string;
  calendarConfig: CalendarConfig;
}): Promise<GoogleCancelBookingResult> {
  const started = Date.now();
  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "GOOGLE_AUTH_FAILED",
        message: "missing tokens",
        durationMs: Date.now() - started,
      };
    }
    const token = await getValidAccessToken(input.connectionId, "google", input.calendarConfig);
    await deleteGoogleCalendarEvent({
      accessToken: token,
      calendarId: input.providerCalendarId,
      eventId: input.providerEventId,
      sendUpdates: "all",
    });
    return { ok: true, durationMs: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("token") || message.includes("401")) {
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
