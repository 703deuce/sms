import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  insertGoogleEvent,
  resolveWriteCalendarId,
  type CalendarConfig,
} from "@/lib/calendar/providers";
import type { CreateBookingRequest } from "../booking-types";

export type GoogleCreateBookingResult =
  | {
      ok: true;
      providerEventId: string;
      providerCalendarId: string;
      durationMs: number;
    }
  | {
      ok: false;
      reason:
        | "GOOGLE_AUTH_FAILED"
        | "GOOGLE_THROTTLED"
        | "GOOGLE_TEMPORARY_FAILURE"
        | "BOOKING_VALIDATION_FAILED"
        | "BOOKING_OUTCOME_UNKNOWN";
      message: string;
      durationMs: number;
      outcomeUncertain?: boolean;
    };

function classifyCreateError(err: unknown): GoogleCreateBookingResult {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let reason:
    | "GOOGLE_AUTH_FAILED"
    | "GOOGLE_THROTTLED"
    | "GOOGLE_TEMPORARY_FAILURE"
    | "BOOKING_VALIDATION_FAILED"
    | "BOOKING_OUTCOME_UNKNOWN" = "GOOGLE_TEMPORARY_FAILURE";
  let outcomeUncertain = false;

  if (lower.includes("token") || lower.includes("401") || lower.includes("unauthorized")) {
    reason = "GOOGLE_AUTH_FAILED";
  } else if (lower.includes("429") || lower.includes("throttl")) {
    reason = "GOOGLE_THROTTLED";
  } else if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("econnreset")) {
    reason = "BOOKING_OUTCOME_UNKNOWN";
    outcomeUncertain = true;
  } else if (lower.includes("validation") || lower.includes("malformed")) {
    reason = "BOOKING_VALIDATION_FAILED";
  }

  return { ok: false, reason, message, durationMs: 0, outcomeUncertain };
}

export async function executeGoogleCreateBooking(input: {
  request: CreateBookingRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
  timeoutMs?: number;
}): Promise<GoogleCreateBookingResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 15_000;

  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "GOOGLE_AUTH_FAILED",
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
        reason: "GOOGLE_AUTH_FAILED",
        message: "Could not obtain Google access token",
        durationMs: Date.now() - started,
      };
    }

    const start = new Date(input.request.startUtc);
    const end = new Date(input.request.endUtc);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return {
        ok: false,
        reason: "BOOKING_VALIDATION_FAILED",
        message: "Invalid booking interval",
        durationMs: Date.now() - started,
      };
    }

    const writeCalendarId =
      input.request.calendarId && input.request.calendarId !== "primary"
        ? input.request.calendarId
        : resolveWriteCalendarId(input.calendarConfig);

    const summary = `${input.request.service.name} — ${input.request.customer.name}`;
    const description = [
      input.request.customer.email ? `Email: ${input.request.customer.email}` : null,
      input.request.customer.phone ? `Phone: ${input.request.customer.phone}` : null,
      `transovo_booking_attempt=${input.request.bookingAttemptId}`,
    ]
      .filter(Boolean)
      .join("\n");

    const providerEventId = await Promise.race([
      insertGoogleEvent(token, writeCalendarId, {
        summary,
        description,
        start,
        end,
        timezone: input.request.timezone,
        transovoAppointmentId: input.request.bookingAttemptId,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google create event timeout")), timeoutMs),
      ),
    ]);

    if (!providerEventId?.trim()) {
      return {
        ok: false,
        reason: "BOOKING_VALIDATION_FAILED",
        message: "Google create returned no event id",
        durationMs: Date.now() - started,
      };
    }

    return {
      ok: true,
      providerEventId: providerEventId.trim(),
      providerCalendarId: writeCalendarId,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const classified = classifyCreateError(err);
    classified.durationMs = Date.now() - started;
    return classified;
  }
}
