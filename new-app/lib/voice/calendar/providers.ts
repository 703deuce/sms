import "server-only";

import { getPrisma } from "@/lib/server/db";
import {
  getMicrosoftAccessToken,
  microsoftCreateEvent,
  microsoftDeleteEvent,
  microsoftGetBusy,
  microsoftListEvents,
  microsoftPatchEventTimes,
} from "@/lib/server/voice-v3/scheduling/microsoft-oauth";

export type CalendarConfig = {
  provider?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  calendarId?: string;
  writeCalendarId?: string;
  blockingCalendarIds?: string[];
  importCalendarIds?: string[];
  email?: string;
  timezone?: string;
  graphMailboxUserPrincipalName?: string;
};

export type BusyInterval = { start: Date; end: Date };

export type MicrosoftGraphContext = {
  connectionId?: string;
  config?: CalendarConfig;
};

export type ProviderCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  locationDisplay?: string;
  showAs?: string;
  status?: string;
  start: Date;
  end: Date;
  attendees?: Array<{ email?: string; name?: string }>;
  transovoOriginated?: boolean;
  transactionId?: string;
};

export function hasOAuthTokens(config: CalendarConfig): boolean {
  return Boolean(config.refreshToken || config.accessToken);
}

export async function getValidAccessToken(
  connectionId: string,
  provider: string,
  _config: CalendarConfig,
): Promise<string> {
  if (provider !== "microsoft") {
    throw new Error(`getValidAccessToken: unsupported provider ${provider}`);
  }
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId },
    select: { workspaceId: true },
  });
  if (!row?.workspaceId) throw new Error("Calendar connection not found");
  return getMicrosoftAccessToken(row.workspaceId, connectionId);
}

async function workspaceForConnection(connectionId: string): Promise<string> {
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId },
    select: { workspaceId: true },
  });
  if (!row?.workspaceId) throw new Error("Calendar connection not found");
  return row.workspaceId;
}

export async function getMicrosoftBusy(
  _token: string,
  timeMin: Date,
  timeMax: Date,
  ctx: {
    calendarId: string;
    connectionId: string;
    config: CalendarConfig;
    smtp?: string;
  },
): Promise<BusyInterval[]> {
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: ctx.connectionId },
    select: { workspaceId: true },
  });
  if (!row?.workspaceId) throw new Error("Calendar connection not found");
  const busy = await microsoftGetBusy({
    workspaceId: row.workspaceId,
    connectionId: ctx.connectionId,
    calendarId: ctx.calendarId,
    rangeStart: timeMin,
    rangeEnd: timeMax,
  });
  return busy.map((b) => ({
    start: new Date(b.start),
    end: new Date(b.end),
  }));
}

export async function insertMicrosoftEvent(
  _accessToken: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    timezone?: string;
    calendarId?: string;
    transovoAppointmentId?: string;
    transactionId?: string;
    location?: string;
    attendees?: Array<{ email: string; name?: string }>;
  },
  ctx?: MicrosoftGraphContext,
): Promise<string | null> {
  const connectionId = ctx?.connectionId?.trim();
  const calendarId =
    event.calendarId?.trim() ||
    ctx?.config?.writeCalendarId?.trim() ||
    ctx?.config?.calendarId?.trim();
  if (!connectionId || !calendarId) {
    throw new Error("insertMicrosoftEvent: connectionId and calendarId required");
  }
  const workspaceId = await workspaceForConnection(connectionId);
  const created = await microsoftCreateEvent({
    workspaceId,
    connectionId,
    calendarId,
    subject: event.summary,
    startIso: event.start.toISOString(),
    endIso: event.end.toISOString(),
    attendeeEmail: event.attendees?.[0]?.email,
  });
  return created.id;
}

export async function updateMicrosoftEvent(
  _accessToken: string,
  eventId: string,
  event: { summary?: string; description?: string; start?: Date; end?: Date; timezone?: string },
  ctx?: MicrosoftGraphContext,
): Promise<void> {
  const connectionId = ctx?.connectionId?.trim();
  const calendarId = ctx?.config?.calendarId?.trim() || ctx?.config?.writeCalendarId?.trim() || "primary";
  if (!connectionId || !event.start || !event.end) {
    throw new Error("updateMicrosoftEvent: connectionId and start/end required");
  }
  const workspaceId = await workspaceForConnection(connectionId);
  await microsoftPatchEventTimes({
    workspaceId,
    connectionId,
    calendarId,
    eventId,
    startIso: event.start.toISOString(),
    endIso: event.end.toISOString(),
  });
}

export async function deleteMicrosoftEvent(
  _accessToken: string,
  eventId: string,
  ctx?: MicrosoftGraphContext,
): Promise<void> {
  const connectionId = ctx?.connectionId?.trim();
  if (!connectionId) throw new Error("deleteMicrosoftEvent: connectionId required");
  const workspaceId = await workspaceForConnection(connectionId);
  await microsoftDeleteEvent({ workspaceId, connectionId, eventId });
}

export async function listMicrosoftCalendarEventsForAppointmentDiscovery(
  _accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId?: string,
  ctx?: MicrosoftGraphContext,
): Promise<ProviderCalendarEvent[]> {
  const connectionId = ctx?.connectionId?.trim();
  const cal =
    calendarId?.trim() ||
    ctx?.config?.calendarId?.trim() ||
    ctx?.config?.writeCalendarId?.trim();
  if (!connectionId || !cal) {
    throw new Error("listMicrosoftCalendarEventsForAppointmentDiscovery: connectionId and calendarId required");
  }
  const workspaceId = await workspaceForConnection(connectionId);
  const events = await microsoftListEvents({
    workspaceId,
    connectionId,
    calendarId: cal,
    rangeStart: timeMin,
    rangeEnd: timeMax,
  });
  return events.map((ev) => ({
    id: ev.id,
    summary: ev.subject,
    start: new Date(ev.startIso),
    end: new Date(ev.endIso),
    attendees: ev.attendeeEmail ? [{ email: ev.attendeeEmail }] : [],
    status: "confirmed",
  }));
}
