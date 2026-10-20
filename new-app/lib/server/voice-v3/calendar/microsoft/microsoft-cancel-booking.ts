import "server-only";

import {
  deleteMicrosoftEvent,
  getValidAccessToken,
  hasOAuthTokens,
  type CalendarConfig,
} from "@/lib/voice/calendar/providers";
import type { CancelBookingRequest } from "../cancel-booking-types";

export type MicrosoftCancelBookingResult =
  | { ok: true; durationMs: number }
  | {
      ok: false;
      reason: "MICROSOFT_AUTH_FAILED" | "MICROSOFT_TEMPORARY_FAILURE" | "CANCELLATION_OUTCOME_UNKNOWN";
      message: string;
      durationMs: number;
      outcomeUncertain?: boolean;
    };

export async function executeMicrosoftCancelBooking(input: {
  request: CancelBookingRequest;
  connectionId: string;
  calendarConfig: CalendarConfig;
  timeoutMs?: number;
}): Promise<MicrosoftCancelBookingResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 15_000;
  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "MICROSOFT_AUTH_FAILED",
        message: "missing tokens",
        durationMs: Date.now() - started,
      };
    }
    const token = await getValidAccessToken(input.connectionId, "microsoft", input.calendarConfig);
    await Promise.race([
      deleteMicrosoftEvent(token, input.request.providerEventId, {
        connectionId: input.connectionId,
        config: input.calendarConfig,
      }),
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
        reason: "MICROSOFT_AUTH_FAILED",
        message,
        durationMs: Date.now() - started,
      };
    }
    return {
      ok: false,
      reason: "MICROSOFT_TEMPORARY_FAILURE",
      message,
      durationMs: Date.now() - started,
    };
  }
}
