import "server-only";

import {
  getGoogleCalendarEvent,
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/calendar/providers";

export type GoogleEventSnapshot =
  | {
      ok: true;
      event: {
        startUtc: string;
        endUtc: string;
        isCancelled: boolean;
      };
    }
  | { ok: false; reason: "not_found" | "auth" | "error"; message: string };

export async function fetchGoogleEventById(input: {
  connectionId: string;
  calendarConfig: CalendarConfig;
  providerEventId: string;
  providerCalendarId: string;
}): Promise<GoogleEventSnapshot> {
  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return { ok: false, reason: "auth", message: "Google OAuth tokens missing" };
    }
    const token = await getValidAccessToken(input.connectionId, "google", input.calendarConfig);
    if (!token) {
      return { ok: false, reason: "auth", message: "Could not obtain Google access token" };
    }
    const event = await getGoogleCalendarEvent(
      token,
      input.providerCalendarId,
      input.providerEventId,
    );
    if (!event) {
      return { ok: false, reason: "not_found", message: "Google event not found" };
    }
    return {
      ok: true,
      event: {
        startUtc: event.start.toISOString(),
        endUtc: event.end.toISOString(),
        isCancelled: event.status === "cancelled",
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (lower.includes("404") || lower.includes("not found")) {
      return { ok: false, reason: "not_found", message };
    }
    if (lower.includes("401") || lower.includes("token")) {
      return { ok: false, reason: "auth", message };
    }
    return { ok: false, reason: "error", message };
  }
}
