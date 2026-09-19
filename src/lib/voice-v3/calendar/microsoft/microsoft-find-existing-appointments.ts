import "server-only";

import {
  getValidAccessToken,
  hasOAuthTokens,
  listMicrosoftCalendarEvents,
  type CalendarConfig,
  type ProviderCalendarEvent,
} from "@/lib/voice/calendar/providers";
import type { ExistingAppointment, ExistingAppointmentCustomerIdentity } from "../appointment-management-types";
import { createId } from "@/lib/supabase/id";

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function parseIdentityFromEventDescription(description: string | undefined): ExistingAppointmentCustomerIdentity {
  const plain = stripHtml(description ?? "");
  const emailMatch = /Email:\s*([^\s\n]+)/i.exec(plain);
  const phoneMatch = /Phone:\s*([^\s\n]+)/i.exec(plain);
  return {
    email: emailMatch?.[1]?.trim(),
    phone: phoneMatch?.[1]?.trim(),
  };
}

function normPhone(p: string): string {
  return p.replace(/\D/g, "");
}

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

function eventMatchesCaller(
  event: ProviderCalendarEvent,
  caller: { phone?: string; email?: string },
): boolean {
  const fromBody = parseIdentityFromEventDescription(event.description);
  const callerPhone = caller.phone ? normPhone(caller.phone) : "";
  const callerEmail = caller.email ? normEmail(caller.email) : "";

  if (callerPhone && fromBody.phone && normPhone(fromBody.phone) === callerPhone) return true;
  if (callerEmail && fromBody.email && normEmail(fromBody.email) === callerEmail) return true;

  for (const attendee of event.attendees ?? []) {
    if (callerEmail && attendee.email && normEmail(attendee.email) === callerEmail) return true;
  }

  return false;
}

function mapGraphEventToExisting(input: {
  event: ProviderCalendarEvent;
  calendarId: string;
  connectionId: string;
  timezone: string;
  localStart: string;
  localEnd: string;
}): ExistingAppointment {
  const identity = parseIdentityFromEventDescription(input.event.description);
  const startUtc = input.event.start.toISOString();
  const endUtc = input.event.end.toISOString();
  const durationMinutes = Math.max(
    1,
    Math.round((input.event.end.getTime() - input.event.start.getTime()) / 60_000),
  );
  return {
    internalBookingId: `ms_evt_${createId()}`,
    provider: "microsoft",
    providerEventId: input.event.id,
    providerCalendarId: input.calendarId,
    providerConnectionId: input.connectionId,
    startUtc,
    endUtc,
    localStart: input.localStart,
    localEnd: input.localEnd,
    timezone: input.timezone,
    customerIdentity: identity,
    durationMinutes,
    status: "ACTIVE",
  };
}

export type MicrosoftFindExistingAppointmentsResult =
  | { ok: true; appointments: ExistingAppointment[]; durationMs: number }
  | { ok: false; reason: "auth" | "configuration" | "error"; message: string; durationMs: number };

/**
 * calendarView search on the configured Voice V3 Microsoft calendar(s).
 */
export async function fetchMicrosoftExistingAppointments(input: {
  connectionId: string;
  calendarConfig: CalendarConfig;
  calendarIds: string[];
  rangeStartUtc: string;
  rangeEndUtc: string;
  timezone: string;
  caller: { phone?: string; email?: string };
  timeoutMs?: number;
}): Promise<MicrosoftFindExistingAppointmentsResult> {
  const started = Date.now();
  const timeoutMs = input.timeoutMs ?? 15_000;

  try {
    if (!hasOAuthTokens(input.calendarConfig)) {
      return {
        ok: false,
        reason: "auth",
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

    const timeMin = new Date(input.rangeStartUtc);
    const timeMax = new Date(input.rangeEndUtc);
    const out: ExistingAppointment[] = [];

    const { formatLocalIsoForZone } = await import("../format-local-iso");

    for (const calendarId of input.calendarIds) {
      const graphCalendarId = calendarId === "primary" ? undefined : calendarId;
      const events = await listMicrosoftCalendarEvents(token, timeMin, timeMax, graphCalendarId, {
        connectionId: input.connectionId,
        config: input.calendarConfig,
      });

      for (const event of events) {
        if (event.status === "cancelled") continue;
        if (!eventMatchesCaller(event, input.caller)) continue;

        const localStart = formatLocalIsoForZone(event.start, input.timezone);
        const localEnd = formatLocalIsoForZone(event.end, input.timezone);
        out.push(
          mapGraphEventToExisting({
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
    return { ok: true, appointments: out, durationMs: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - started,
    };
  }
}
