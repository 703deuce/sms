import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  insertMicrosoftEvent,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import type { CreateBookingRequest } from "../booking-types";
import { resolveMicrosoftGraphCalendarId } from "../resolve-provider-calendar-id";

export type MicrosoftCreateBookingResult =
  | {
      ok: true;
      providerEventId: string;
      providerCalendarId: string;
      durationMs: number;
    }
  | {
      ok: false;
      reason:
        | "MICROSOFT_AUTH_FAILED"
        | "MICROSOFT_THROTTLED"
        | "MICROSOFT_TEMPORARY_FAILURE"
        | "BOOKING_VALIDATION_FAILED"
        | "BOOKING_OUTCOME_UNKNOWN";
      message: string;
      durationMs: number;
      outcomeUncertain?: boolean;
    };

function classifyCreateError(err: unknown): MicrosoftCreateBookingResult {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  let reason:
    | "MICROSOFT_AUTH_FAILED"
    | "MICROSOFT_THROTTLED"
    | "MICROSOFT_TEMPORARY_FAILURE"
    | "BOOKING_VALIDATION_FAILED"
    | "BOOKING_OUTCOME_UNKNOWN" = "MICROSOFT_TEMPORARY_FAILURE";
  let outcomeUncertain = false;

  if (lower.includes("token") || lower.includes("401") || lower.includes("unauthorized")) {
    reason = "MICROSOFT_AUTH_FAILED";
  } else if (lower.includes("429") || lower.includes("throttl")) {
    reason = "MICROSOFT_THROTTLED";
  } else if (lower.includes("timeout") || lower.includes("etimedout") || lower.includes("econnreset")) {
    reason = "BOOKING_OUTCOME_UNKNOWN";
    outcomeUncertain = true;
  } else if (
    lower.includes("validation") ||
    lower.includes("malformed") ||
    lower.includes(" 400")
  ) {
    reason = "BOOKING_VALIDATION_FAILED";
  }

  return { ok: false, reason, message, durationMs: 0, outcomeUncertain };
}

/**
 * Certified V3 Microsoft BOOK — uses authoritative CreateBookingRequest only.
 * transactionId = bookingAttemptId for Graph idempotency on safe retries.
 */
export async function executeMicrosoftCreateBooking(input: {
  request: CreateBookingRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
  timeoutMs?: number;
}): Promise<MicrosoftCreateBookingResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 15_000;

  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "MICROSOFT_AUTH_FAILED",
        message: "Microsoft OAuth tokens missing",
        durationMs: Date.now() - started,
      };
    }

    const token = await Promise.race([
      getValidAccessToken(input.connectionId, "microsoft", input.calendarConfig),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Microsoft token timeout")), timeoutMs),
      ),
    ]);

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

    const summary = `${input.request.service.name} — ${input.request.customer.name}`;
    const description = [
      input.request.customer.email ? `Email: ${input.request.customer.email}` : null,
      input.request.customer.phone ? `Phone: ${input.request.customer.phone}` : null,
      `transovo_booking_attempt=${input.request.bookingAttemptId}`,
    ]
      .filter(Boolean)
      .join("\n");

    const providerEventId = await Promise.race([
      insertMicrosoftEvent(
        token,
        {
          summary,
          description,
          start,
          end,
          timezone: input.request.timezone,
          calendarId: resolveMicrosoftGraphCalendarId(input.request.calendarId),
          transactionId: input.request.bookingAttemptId,
          transovoAppointmentId: input.request.bookingAttemptId,
        },
        { connectionId: input.connectionId, config: input.calendarConfig },
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Microsoft create event timeout")), timeoutMs),
      ),
    ]);

    if (!providerEventId?.trim()) {
      return {
        ok: false,
        reason: "BOOKING_VALIDATION_FAILED",
        message: "Microsoft create returned no event id",
        durationMs: Date.now() - started,
      };
    }

    return {
      ok: true,
      providerEventId: providerEventId.trim(),
      providerCalendarId: input.request.calendarId,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const classified = classifyCreateError(err);
    classified.durationMs = Date.now() - started;
    console.error("MICROSOFT_BOOK_CREATE_FAILED", {
      booking_attempt_id: input.request.bookingAttemptId,
      call_id: input.request.callId,
      calendar_id: input.request.calendarId,
      reason: classified.reason,
      message: classified.message,
      duration_ms: classified.durationMs,
    });
    return classified;
  }
}
