import "server-only";

import {
  getMicrosoftBusy,
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import type { FindAvailabilityRequest } from "../types";
import type { CalendarBusyInterval } from "../types";

export type MicrosoftFindAvailabilityResult =
  | { ok: true; busy: CalendarBusyInterval[]; durationMs: number }
  | {
      ok: false;
      reason: "microsoft_token" | "microsoft_timeout" | "microsoft_throttled" | "microsoft_malformed" | "microsoft_error";
      message: string;
      durationMs: number;
    };

function classifyMicrosoftError(err: unknown): MicrosoftFindAvailabilityResult {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let reason: "microsoft_token" | "microsoft_timeout" | "microsoft_throttled" | "microsoft_malformed" | "microsoft_error" =
    "microsoft_error";
  if (lower.includes("token") || lower.includes("401") || lower.includes("unauthorized")) {
    reason = "microsoft_token";
  } else if (lower.includes("timeout") || lower.includes("etimedout")) {
    reason = "microsoft_timeout";
  } else if (lower.includes("429") || lower.includes("throttl")) {
    reason = "microsoft_throttled";
  } else if (lower.includes("json") || lower.includes("malformed")) {
    reason = "microsoft_malformed";
  }
  return { ok: false, reason, message, durationMs: 0 };
}

/**
 * Microsoft Graph busy lookup — calendar facts only.
 * Uses POST /me/calendar/getSchedule when connection context is available,
 * otherwise calendarView on the configured calendar id.
 */
export async function fetchMicrosoftBusyIntervals(input: {
  request: FindAvailabilityRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
  timeoutMs?: number;
}): Promise<MicrosoftFindAvailabilityResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 12_000;

  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "microsoft_token",
        message: "Microsoft OAuth tokens missing",
        durationMs: Date.now() - started,
      };
    }

    const token = await Promise.race([
      getValidAccessToken(input.connectionId, input.calendarConfig),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Microsoft token timeout")), timeoutMs),
      ),
    ]);

    const timeMin = new Date(input.request.rangeStartUtc);
    const timeMax = new Date(input.request.rangeEndUtc);

    const allBusy: CalendarBusyInterval[] = [];

    for (const calendarId of input.request.calendarIds) {
      const busy = await Promise.race([
        getMicrosoftBusy(token, timeMin, timeMax, {
          calendarId,
          connectionId: input.connectionId,
          config: input.calendarConfig,
          smtp: input.calendarConfig.email,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Microsoft Graph timeout")), timeoutMs),
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
    const classified = classifyMicrosoftError(err);
    classified.durationMs = Date.now() - started;
    return classified;
  }
}
