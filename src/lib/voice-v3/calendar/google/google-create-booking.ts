import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import type { CreateBookingRequest } from "../booking-types";
import { insertGoogleCalendarEvent } from "./google-events-api";

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
  let reason: GoogleCreateBookingResult & { ok: false }["reason"] =
    "GOOGLE_TEMPORARY_FAILURE";
  let outcomeUncertain = false;
  if (lower.includes("token") || lower.includes("401")) {
    reason = "GOOGLE_AUTH_FAILED";
  } else if (lower.includes("429") || lower.includes("throttl")) {
    reason = "GOOGLE_THROTTLED";
  } else if (lower.includes("timeout") || lower.includes("econnreset")) {
    reason = "BOOKING_OUTCOME_UNKNOWN";
    outcomeUncertain = true;
  }
  return { ok: false, reason, message, durationMs: 0, outcomeUncertain };
}

function buildGoogleDescription(request: CreateBookingRequest): string {
  return [
    "Booked by Transovo",
    request.customer.name && `Customer: ${request.customer.name}`,
    request.customer.phone && `Phone: ${request.customer.phone}`,
    request.service.name && `Service: ${request.service.name}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function executeGoogleCreateBooking(input: {
  request: CreateBookingRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
  workspaceId?: string;
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

    const calendarId = input.request.calendarId || "primary";
    const summary = `${input.request.service.name} — ${input.request.customer.name}`;
    const privateProps: Record<string, string> = {
      transovoAppointmentId: input.request.bookingAttemptId,
    };
    if (input.workspaceId) {
      privateProps.transovoWorkspaceId = input.workspaceId;
    }

    const eventId = await Promise.race([
      insertGoogleCalendarEvent({
        accessToken: token,
        calendarId,
        sendUpdates: input.request.customer.email ? "all" : "none",
        body: {
          summary,
          description: buildGoogleDescription(input.request),
          start: {
            dateTime: input.request.startUtc,
            timeZone: input.request.timezone,
          },
          end: {
            dateTime: input.request.endUtc,
            timeZone: input.request.timezone,
          },
          attendees: input.request.customer.email
            ? [{ email: input.request.customer.email }]
            : undefined,
          extendedProperties: { private: privateProps },
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Google insert timeout")), timeoutMs),
      ),
    ]);

    return {
      ok: true,
      providerEventId: eventId,
      providerCalendarId: calendarId,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const classified = classifyCreateError(err);
    classified.durationMs = Date.now() - started;
    return classified;
  }
}
