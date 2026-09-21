import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  updateGoogleEvent,
  type CalendarConfig,
} from "@/lib/calendar/providers";

export type GoogleUpdateBookingRequest = {
  connectionId: string;
  providerEventId: string;
  providerCalendarId: string;
  startUtc: string;
  endUtc: string;
  timezone: string;
  summary: string;
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
    if (!token) {
      return {
        ok: false,
        reason: "GOOGLE_AUTH_FAILED",
        message: "Could not obtain Google access token",
        durationMs: Date.now() - started,
      };
    }
    const start = new Date(request.startUtc);
    const end = new Date(request.endUtc);
    await Promise.race([
      updateGoogleEvent(token, request.providerCalendarId, request.providerEventId, {
        summary: request.summary,
        start,
        end,
        timezone: request.timezone,
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
