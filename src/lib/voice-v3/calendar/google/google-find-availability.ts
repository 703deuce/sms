import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import type { FindAvailabilityRequest } from "../types";
import type { CalendarBusyInterval } from "../types";
import {
  googleEventBlocksAvailability,
  listGoogleCalendarEventsPaginated,
} from "./google-events-api";

export type GoogleFindAvailabilityResult =
  | { ok: true; busy: CalendarBusyInterval[]; durationMs: number }
  | {
      ok: false;
      reason: "google_token" | "google_timeout" | "google_throttled" | "google_error";
      message: string;
      durationMs: number;
    };

function classifyGoogleError(err: unknown): GoogleFindAvailabilityResult {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let reason: GoogleFindAvailabilityResult & { ok: false }["reason"] = "google_error";
  if (lower.includes("token") || lower.includes("401") || lower.includes("unauthorized")) {
    reason = "google_token";
  } else if (lower.includes("timeout") || lower.includes("etimedout")) {
    reason = "google_timeout";
  } else if (lower.includes("429") || lower.includes("throttl") || lower.includes("403")) {
    reason = "google_throttled";
  }
  return { ok: false, reason, message, durationMs: 0 };
}

export async function fetchGoogleBusyIntervals(input: {
  request: FindAvailabilityRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
  calendarIds: string[];
  timeoutMs?: number;
}): Promise<GoogleFindAvailabilityResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 12_000;

  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "google_token",
        message: "Google OAuth tokens missing",
        durationMs: Date.now() - started,
      };
    }

    const token = await Promise.race([
      getValidAccessToken(input.connectionId, "google", input.calendarConfig),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google token timeout")), timeoutMs),
      ),
    ]);
    if (!token) {
      return {
        ok: false,
        reason: "google_token",
        message: "Google access token unavailable",
        durationMs: Date.now() - started,
      };
    }

    const timeMin = new Date(input.request.rangeStartUtc);
    const timeMax = new Date(input.request.rangeEndUtc);
    const allBusy: CalendarBusyInterval[] = [];

    for (const calendarId of input.calendarIds) {
      const events = await listGoogleCalendarEventsPaginated({
        accessToken: token,
        calendarId,
        timeMin,
        timeMax,
        timeZone: input.request.timezone,
        showDeleted: false,
      });

      for (const event of events) {
        if (!googleEventBlocksAvailability(event)) continue;
        const startRaw = event.start?.dateTime || event.start?.date;
        const endRaw = event.end?.dateTime || event.end?.date;
        if (!startRaw || !endRaw) continue;
        const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
        const start = new Date(isAllDay ? `${startRaw}T00:00:00Z` : startRaw);
        const end = new Date(isAllDay ? `${endRaw}T00:00:00Z` : endRaw);
        allBusy.push({
          calendarId,
          startUtc: start.toISOString(),
          endUtc: end.toISOString(),
        });
      }
    }

    return { ok: true, busy: allBusy, durationMs: Date.now() - started };
  } catch (err) {
    const classified = classifyGoogleError(err);
    classified.durationMs = Date.now() - started;
    return classified;
  }
}
