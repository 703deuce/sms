import "server-only";

import {
  deleteGoogleEvent,
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import type { CancelBookingRequest } from "../cancel-booking-types";

export type GoogleCancelBookingResult =
  | { ok: true; durationMs: number }
  | {
      ok: false;
      reason: "GOOGLE_AUTH_FAILED" | "GOOGLE_TEMPORARY_FAILURE" | "CANCELLATION_OUTCOME_UNKNOWN";
      message: string;
      durationMs: number;
      outcomeUncertain?: boolean;
    };

export async function executeGoogleCancelBooking(input: {
  request: CancelBookingRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
  timeoutMs?: number;
}): Promise<GoogleCancelBookingResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 15_000;
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
    if (!token) {
      return {
        ok: false,
        reason: "GOOGLE_AUTH_FAILED",
        message: "Could not obtain Google access token",
        durationMs: Date.now() - started,
      };
    }
    await Promise.race([
      deleteGoogleEvent(token, input.request.providerCalendarId, input.request.providerEventId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("cancel timeout")), timeoutMs),
      ),
    ]);
    return { ok: true, durationMs: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("econnreset")) {
      return {
        ok: false,
        reason: "CANCELLATION_OUTCOME_UNKNOWN",
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
