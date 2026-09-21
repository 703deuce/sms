import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  listGoogleCalendarEvents,
  type CalendarConfig,
  type ProviderCalendarEvent,
} from "@/lib/calendar/providers";
import type { ExistingAppointment } from "../appointment-management-types";
import { stableGoogleDiscoveryBookingId } from "../google-discovery-selection-id";
import {
  extractIdentityFromEventFields,
  extractTransovoLabeledIdentity,
} from "../appointment-discovery-identity";
import {
  buildSafeAppointmentDisplay,
  type AppointmentDiscoveryRecord,
} from "../appointment-discovery-match";

function mapGoogleEventToDiscoveryRecord(input: {
  event: ProviderCalendarEvent;
  calendarId: string;
  connectionId: string;
  timezone: string;
  localStart: string;
  localEnd: string;
}): AppointmentDiscoveryRecord {
  const plainBody = (input.event.description ?? "").replace(/<[^>]+>/g, " ");
  const labeled = extractTransovoLabeledIdentity(plainBody);
  const discovery = extractIdentityFromEventFields({
    subject: input.event.summary,
    description: input.event.description,
    location: input.event.locationDisplay,
    attendeeNames: (input.event.attendees ?? []).map((a) => a.name).filter(Boolean) as string[],
    attendeeEmails: (input.event.attendees ?? []).map((a) => a.email).filter(Boolean) as string[],
  });

  const startUtc = input.event.start.toISOString();
  const endUtc = input.event.end.toISOString();
  const durationMinutes = Math.max(
    1,
    Math.round((input.event.end.getTime() - input.event.start.getTime()) / 60_000),
  );

  const appointment: ExistingAppointment = {
    internalBookingId: stableGoogleDiscoveryBookingId(
      input.connectionId,
      input.calendarId,
      input.event.id,
    ),
    provider: "google",
    providerEventId: input.event.id,
    providerCalendarId: input.calendarId,
    providerConnectionId: input.connectionId,
    startUtc,
    endUtc,
    localStart: input.localStart,
    localEnd: input.localEnd,
    timezone: input.timezone,
    customerIdentity: {
      name: discovery.names[0] ?? undefined,
      email: labeled.email ?? discovery.emails[0],
      phone: labeled.phone ?? discovery.phones[0],
    },
    durationMinutes,
    status: "ACTIVE",
  };

  return {
    ...appointment,
    discovery,
    safeDisplay: buildSafeAppointmentDisplay(appointment, discovery, input.timezone),
  };
}

export type GoogleFetchDiscoveryCandidatesResult =
  | { ok: true; candidates: AppointmentDiscoveryRecord[]; durationMs: number }
  | { ok: false; reason: "auth" | "configuration" | "error"; message: string; durationMs: number };

export async function fetchGoogleAppointmentDiscoveryCandidates(input: {
  connectionId: string;
  calendarConfig: CalendarConfig;
  calendarIds: string[];
  rangeStartUtc: string;
  rangeEndUtc: string;
  timezone: string;
  timeoutMs?: number;
}): Promise<GoogleFetchDiscoveryCandidatesResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 20_000;

  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "auth",
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
        reason: "auth",
        message: "Could not obtain Google access token",
        durationMs: Date.now() - started,
      };
    }

    const timeMin = new Date(input.rangeStartUtc);
    const timeMax = new Date(input.rangeEndUtc);
    const out: AppointmentDiscoveryRecord[] = [];
    const { formatLocalIsoForZone } = await import("../format-local-iso");

    for (const calendarId of input.calendarIds) {
      const events = await listGoogleCalendarEvents(token, calendarId, timeMin, timeMax);

      for (const event of events) {
        if (event.status === "cancelled") continue;
        const localStart = formatLocalIsoForZone(event.start, input.timezone);
        const localEnd = formatLocalIsoForZone(event.end, input.timezone);
        out.push(
          mapGoogleEventToDiscoveryRecord({
            event,
            calendarId,
            connectionId: input.connectionId,
            timezone: input.timezone,
            localStart,
            localEnd,
          }),
        );
      }
    }

    out.sort((a, b) => a.startUtc.localeCompare(b.startUtc));
    return { ok: true, candidates: out, durationMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }
}
