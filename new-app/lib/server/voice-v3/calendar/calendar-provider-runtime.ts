import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { CreateBookingRequest, BookingFailure } from "./booking-types";
import type { CancelBookingRequest } from "./cancel-booking-types";
import type { FindAvailabilityRequest, CalendarBusyInterval } from "./types";
import type { CalendarConfig } from "@/lib/voice/calendar/providers";
import { calendarProviderForConfig } from "./direct-booking-strategy";

export type ResolvedDirectCalendar =
  | {
      ok: true;
      provider: "microsoft" | "google";
      connectionId: string;
      calendarConfig: CalendarConfig;
      calendarIds: string[];
    }
  | { ok: false; message: string };

export async function resolveDirectCalendarForConfig(
  config: VoiceV3AgentConfig,
): Promise<ResolvedDirectCalendar> {
  const provider = calendarProviderForConfig(config) ?? config.calendar?.provider;
  if (provider === "google") {
    const { resolveVoiceV3GoogleCalendar } = await import(
      "./google/resolve-voice-v3-google-calendar"
    );
    const resolved = await resolveVoiceV3GoogleCalendar(config);
    if (!resolved.ok) return { ok: false, message: resolved.message };
    return {
      ok: true,
      provider: "google",
      connectionId: resolved.connectionId,
      calendarConfig: resolved.calendarConfig,
      calendarIds: resolved.calendarIds,
    };
  }

  const { resolveVoiceV3MicrosoftCalendar } = await import(
    "./microsoft/resolve-voice-v3-microsoft-calendar"
  );
  const resolved = await resolveVoiceV3MicrosoftCalendar(config);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  return {
    ok: true,
    provider: "microsoft",
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
    calendarIds: resolved.calendarIds,
  };
}

export type FetchBusyResult =
  | { ok: true; busy: CalendarBusyInterval[]; durationMs: number }
  | {
      ok: false;
      reason: string;
      message: string;
      durationMs: number;
    };

export async function fetchVoiceV3BusyIntervals(input: {
  config: VoiceV3AgentConfig;
  request: FindAvailabilityRequest;
}): Promise<FetchBusyResult> {
  const resolved = await resolveDirectCalendarForConfig(input.config);
  if (!resolved.ok) {
    return {
      ok: false,
      reason: "configuration_missing",
      message: resolved.message,
      durationMs: 0,
    };
  }

  if (resolved.provider === "google") {
    const { fetchGoogleBusyIntervals } = await import("./google/google-find-availability");
    const result = await fetchGoogleBusyIntervals({
      request: input.request,
      connectionId: resolved.connectionId,
      calendarConfig: resolved.calendarConfig,
      calendarIds: resolved.calendarIds,
    });
    if (result.ok) {
      return { ok: true, busy: result.busy, durationMs: result.durationMs };
    }
    return {
      ok: false,
      reason: result.reason,
      message: result.message,
      durationMs: result.durationMs,
    };
  }

  const { fetchMicrosoftBusyIntervals } = await import("./microsoft/microsoft-find-availability");
  const result = await fetchMicrosoftBusyIntervals({
    request: input.request,
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
  });
  if (result.ok) {
    return { ok: true, busy: result.busy, durationMs: result.durationMs };
  }
  return {
    ok: false,
    reason: result.reason,
    message: result.message,
    durationMs: result.durationMs,
  };
}

export type CreateBookingRuntimeResult =
  | { ok: true; providerEventId: string; providerCalendarId: string; durationMs: number }
  | { ok: false; failure: BookingFailure; durationMs: number; outcomeUncertain?: boolean };

export async function executeVoiceV3CreateBooking(input: {
  config: VoiceV3AgentConfig;
  request: CreateBookingRequest;
  bookingAttemptId: string;
  schedulingGeneration: number;
}): Promise<CreateBookingRuntimeResult> {
  const resolved = await resolveDirectCalendarForConfig(input.config);
  const at = new Date().toISOString();
  if (!resolved.ok) {
    return {
      ok: false,
      durationMs: 0,
      failure: {
        reason: "configuration_missing",
        message: resolved.message,
        at,
        bookingAttemptId: input.bookingAttemptId,
        schedulingGeneration: input.schedulingGeneration,
      },
    };
  }

  if (resolved.provider === "google") {
    const { executeGoogleCreateBooking } = await import("./google/google-create-booking");
    const ms = await executeGoogleCreateBooking({
      request: input.request,
      connectionId: resolved.connectionId,
      calendarConfig: resolved.calendarConfig,
      workspaceId: input.config.workspaceId,
    });
    if (ms.ok) {
      return {
        ok: true,
        providerEventId: ms.providerEventId,
        providerCalendarId: ms.providerCalendarId,
        durationMs: ms.durationMs,
      };
    }
    return {
      ok: false,
      durationMs: ms.durationMs,
      outcomeUncertain: ms.outcomeUncertain,
      failure: {
        reason: ms.reason as BookingFailure["reason"],
        message: ms.message,
        at,
        bookingAttemptId: input.bookingAttemptId,
        schedulingGeneration: input.schedulingGeneration,
      },
    };
  }

  const { executeMicrosoftCreateBooking } = await import("./microsoft/microsoft-create-booking");
  const ms = await executeMicrosoftCreateBooking({
    request: input.request,
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
  });
  if (ms.ok) {
    return {
      ok: true,
      providerEventId: ms.providerEventId,
      providerCalendarId: ms.providerCalendarId,
      durationMs: ms.durationMs,
    };
  }
  return {
    ok: false,
    durationMs: ms.durationMs,
    outcomeUncertain: ms.outcomeUncertain,
    failure: {
      reason: ms.reason as BookingFailure["reason"],
      message: ms.message,
      at,
      bookingAttemptId: input.bookingAttemptId,
      schedulingGeneration: input.schedulingGeneration,
    },
  };
}

export function mapBusyFailureToBookingFailure(input: {
  reason: string;
  message: string;
  bookingAttemptId: string;
  schedulingGeneration: number;
}): BookingFailure {
  const at = new Date().toISOString();
  const r = input.reason;
  if (r === "microsoft_token" || r === "google_token") {
    return {
      reason: r === "google_token" ? "GOOGLE_AUTH_FAILED" : "MICROSOFT_AUTH_FAILED",
      message: input.message,
      at,
      bookingAttemptId: input.bookingAttemptId,
      schedulingGeneration: input.schedulingGeneration,
    };
  }
  if (r === "microsoft_throttled" || r === "google_throttled") {
    return {
      reason: r === "google_throttled" ? "GOOGLE_THROTTLED" : "MICROSOFT_THROTTLED",
      message: input.message,
      at,
      bookingAttemptId: input.bookingAttemptId,
      schedulingGeneration: input.schedulingGeneration,
    };
  }
  if (
    r === "microsoft_timeout" ||
    r === "google_timeout" ||
    r === "microsoft_error" ||
    r === "google_error"
  ) {
    return {
      reason:
        r.startsWith("google") ? "GOOGLE_TEMPORARY_FAILURE" : "MICROSOFT_TEMPORARY_FAILURE",
      message: input.message,
      at,
      bookingAttemptId: input.bookingAttemptId,
      schedulingGeneration: input.schedulingGeneration,
    };
  }
  return {
    reason: "configuration_missing",
    message: input.message,
    at,
    bookingAttemptId: input.bookingAttemptId,
    schedulingGeneration: input.schedulingGeneration,
  };
}

export async function executeVoiceV3CancelBooking(input: {
  config: VoiceV3AgentConfig;
  request: CancelBookingRequest;
  providerCalendarId: string;
  providerEventId: string;
}): Promise<
  | { ok: true; durationMs: number }
  | { ok: false; message: string; outcomeUncertain?: boolean }
> {
  const resolved = await resolveDirectCalendarForConfig(input.config);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message };
  }

  if (resolved.provider === "google") {
    const { executeGoogleCancelBooking } = await import("./google/google-cancel-booking");
    const r = await executeGoogleCancelBooking({
      connectionId: resolved.connectionId,
      providerEventId: input.providerEventId,
      providerCalendarId: input.providerCalendarId,
      calendarConfig: resolved.calendarConfig,
    });
    if (r.ok) return { ok: true, durationMs: r.durationMs };
    return { ok: false, message: r.message };
  }

  const { executeMicrosoftCancelBooking } = await import("./microsoft/microsoft-cancel-booking");
  const ms = await executeMicrosoftCancelBooking({
    request: input.request,
    connectionId: resolved.connectionId,
    calendarConfig: resolved.calendarConfig,
  });
  if (ms.ok) return { ok: true, durationMs: ms.durationMs };
  return { ok: false, message: ms.message, outcomeUncertain: ms.outcomeUncertain };
}
