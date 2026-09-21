import "server-only";

import {
  getGoogleBusy,
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import type { FindAvailabilityRequest } from "../types";
import type { CalendarBusyInterval } from "../types";

export type GoogleFindAvailabilityResult =
  | { ok: true; busy: CalendarBusyInterval[]; durationMs: number }
  | {
      ok: false;
      reason:
        | "google_token"
        | "google_timeout"
        | "google_throttled"
        | "google_malformed"
        | "google_error";
      message: string;
      durationMs: number;
    };

function classifyGoogleError(err: unknown): GoogleFindAvailabilityResult {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let reason:
    | "google_token"
    | "google_timeout"
    | "google_throttled"
    | "google_malformed"
    | "google_error" = "google_error";
  if (lower.includes("token") || lower.includes("401") || lower.includes("unauthorized")) {
    reason = "google_token";
  } else if (lower.includes("timeout") || lower.includes("etimedout")) {
    reason = "google_timeout";
  } else if (lower.includes("429") || lower.includes("throttl")) {
    reason = "google_throttled";
  } else if (lower.includes("json") || lower.includes("malformed")) {
    reason = "google_malformed";
  }
  return { ok: false, reason, message, durationMs: 0 };
}

export async function fetchGoogleBusyIntervals(input: {
  request: FindAvailabilityRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
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
        message: "Could not obtain Google access token",
        durationMs: Date.now() - started,
      };
    }

    const timeMin = new Date(input.request.rangeStartUtc);
    const timeMax = new Date(input.request.rangeEndUtc);
    const allBusy: CalendarBusyInterval[] = [];

    for (const calendarId of input.request.calendarIds) {
      const busy = await Promise.race([
        getGoogleBusy(token, calendarId, timeMin, timeMax),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Google Calendar timeout")), timeoutMs),
        ),
      ]);

      for (const interval of busy) {
        allBusy.push({
          calendarId,
          startUtc: interval.start.toISOString(),
          endUtc: interval.end.toISOString(),
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
