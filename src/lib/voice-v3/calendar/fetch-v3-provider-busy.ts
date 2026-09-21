import "server-only";

import type { VoiceV3AgentConfig } from "../config/agent-config";
import type { FindAvailabilityRequest, FindAvailabilityFailure, CalendarBusyInterval } from "./types";

export type FetchV3ProviderBusyResult =
  | { ok: true; busy: CalendarBusyInterval[]; durationMs: number }
  | { ok: false; failure: FindAvailabilityFailure; durationMs: number };

/**
 * Provider dispatch for V3 FIND / BOOK revalidation busy lookup.
 * Slot generation and offer sets remain upstream/downstream of this boundary.
 */
export async function fetchV3ProviderBusyIntervals(input: {
  request: FindAvailabilityRequest;
  config: VoiceV3AgentConfig;
}): Promise<FetchV3ProviderBusyResult> {
  const calendar = input.config.calendar;
  const at = new Date().toISOString();
  const schedulingGeneration = input.request.schedulingGeneration;

  if (!calendar?.connectionId) {
    return {
      ok: false,
      durationMs: 0,
      failure: {
        reason: "configuration_missing",
        message: "Calendar not configured on agent",
        at,
        schedulingGeneration,
      },
    };
  }

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const connection = await prisma.voiceCalendarConnection.findFirst({
    where: { id: calendar.connectionId, provider: calendar.provider },
  });

  if (!connection || connection.status !== "connected") {
    return {
      ok: false,
      durationMs: 0,
      failure: {
        reason: "configuration_missing",
        message: `${calendar.provider} calendar connection not found or not connected`,
        at,
        schedulingGeneration,
      },
    };
  }

  const calendarConfig = (connection.config || {}) as import("@/lib/voice/calendar/providers").CalendarConfig;

  if (calendar.provider === "google") {
    const { fetchGoogleBusyIntervals } = await import("./google/google-find-availability");
    const result = await fetchGoogleBusyIntervals({
      request: input.request,
      connectionId: connection.id,
      calendarConfig,
    });
    if (result.ok) {
      return { ok: true, busy: result.busy, durationMs: result.durationMs };
    }
    return {
      ok: false,
      durationMs: result.durationMs,
      failure: {
        reason: result.reason,
        message: result.message,
        at,
        schedulingGeneration,
      },
    };
  }

  const { fetchMicrosoftBusyIntervals } = await import("./microsoft/microsoft-find-availability");
  const result = await fetchMicrosoftBusyIntervals({
    request: input.request,
    connectionId: connection.id,
    calendarConfig,
  });
  if (result.ok) {
    return { ok: true, busy: result.busy, durationMs: result.durationMs };
  }
  return {
    ok: false,
    durationMs: result.durationMs,
    failure: {
      reason: result.reason,
      message: result.message,
      at,
      schedulingGeneration,
    },
  };
}
