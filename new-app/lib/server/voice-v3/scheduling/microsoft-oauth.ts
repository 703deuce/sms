import "server-only";

import { getPrisma } from "@/lib/server/db";
import {
  microsoftCalendarViewUrl,
  microsoftCreateEventUrl,
} from "./microsoft-graph-calendar-urls";

type CalendarConfig = Record<string, unknown>;

function clientCreds() {
  const clientId =
    process.env.MICROSOFT_CLIENT_ID?.trim() || process.env.MICROSOFT_CALENDAR_CLIENT_ID?.trim();
  const clientSecret =
    process.env.MICROSOFT_CLIENT_SECRET?.trim() ||
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth env not configured");
  }
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || "common";
  return { clientId, clientSecret, tenant };
}

export async function getMicrosoftAccessToken(
  workspaceId: string,
  connectionId: string,
): Promise<string> {
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "microsoft" },
  });
  if (!row) throw new Error("Microsoft calendar connection not found");
  const config = (row.config || {}) as CalendarConfig;
  const access = typeof config.accessToken === "string" ? config.accessToken : "";
  const expiresAt = typeof config.expiresAt === "number" ? config.expiresAt : 0;
  if (access && expiresAt > Date.now() + 60_000) return access;

  const refresh = typeof config.refreshToken === "string" ? config.refreshToken : "";
  if (!refresh) throw new Error("Microsoft refresh token missing — reconnect calendar");

  const { clientId, clientSecret, tenant } = clientCreds();
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refresh,
      scope: "offline_access Calendars.ReadWrite",
    }),
  });
  if (!res.ok) {
    throw new Error(`Microsoft token refresh failed: ${res.status}`);
  }
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) throw new Error("Microsoft token refresh returned no access_token");

  const nextConfig = {
    ...config,
    accessToken: body.access_token,
    refreshToken: body.refresh_token || refresh,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  await getPrisma().voiceCalendarConnection.update({
    where: { id: connectionId },
    data: { config: nextConfig },
  });
  return body.access_token;
}

export async function microsoftGetBusy(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<{ start: string; end: string }[]> {
  const verify = await import("./microsoft-scheduling-verify-mock");
  if (verify.isMicrosoftSchedulingVerifyMock()) {
    return verify.verifyMockGetBusy();
  }
  const token = await getMicrosoftAccessToken(input.workspaceId, input.connectionId);
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId },
    select: { config: true },
  });
  const connCfg = (row?.config || {}) as CalendarConfig;
  const viewBase = microsoftCalendarViewUrl({
    calendarId: input.calendarId,
    mailboxUserPrincipalName:
      typeof connCfg.graphMailboxUserPrincipalName === "string"
        ? connCfg.graphMailboxUserPrincipalName
        : null,
  });
  const url = `${viewBase}?startDateTime=${encodeURIComponent(
    input.rangeStart.toISOString(),
  )}&endDateTime=${encodeURIComponent(input.rangeEnd.toISOString())}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Microsoft calendarView failed: ${res.status} ${detail.slice(0, 180)}`,
    );
  }
  const body = (await res.json()) as { value?: { start?: { dateTime?: string }; end?: { dateTime?: string } }[] };
  return (body.value || [])
    .map((ev) => ({
      start: ev.start?.dateTime || "",
      end: ev.end?.dateTime || "",
    }))
    .filter((x) => x.start && x.end);
}

export async function microsoftCreateEvent(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  subject: string;
  startIso: string;
  endIso: string;
  attendeeEmail?: string;
}): Promise<{ id: string }> {
  const verify = await import("./microsoft-scheduling-verify-mock");
  if (verify.isMicrosoftSchedulingVerifyMock()) {
    return verify.verifyMockCreateEvent({ startIso: input.startIso });
  }
  const token = await getMicrosoftAccessToken(input.workspaceId, input.connectionId);
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId },
    select: { config: true },
  });
  const connCfg = (row?.config || {}) as CalendarConfig;
  const url = microsoftCreateEventUrl({
    calendarId: input.calendarId,
    mailboxUserPrincipalName:
      typeof connCfg.graphMailboxUserPrincipalName === "string"
        ? connCfg.graphMailboxUserPrincipalName
        : null,
  });
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      subject: input.subject,
      start: { dateTime: input.startIso, timeZone: "UTC" },
      end: { dateTime: input.endIso, timeZone: "UTC" },
      attendees: input.attendeeEmail
        ? [{ emailAddress: { address: input.attendeeEmail }, type: "required" }]
        : [],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft create event failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error("Microsoft create event missing id");
  return { id: body.id };
}

export type MicrosoftCalendarEvent = {
  id: string;
  subject: string;
  startIso: string;
  endIso: string;
  attendeeEmail?: string;
};

export async function microsoftListEvents(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<MicrosoftCalendarEvent[]> {
  const verify = await import("./microsoft-scheduling-verify-mock");
  if (verify.isMicrosoftSchedulingVerifyMock()) {
    const rows = await verify.verifyMockListEvents();
    return rows.map((r) => ({
      id: r.id,
      subject: r.subject,
      startIso: r.start,
      endIso: r.end,
    }));
  }
  const token = await getMicrosoftAccessToken(input.workspaceId, input.connectionId);
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: input.connectionId, workspaceId: input.workspaceId },
    select: { config: true },
  });
  const connCfg = (row?.config || {}) as CalendarConfig;
  const viewBase = microsoftCalendarViewUrl({
    calendarId: input.calendarId,
    mailboxUserPrincipalName:
      typeof connCfg.graphMailboxUserPrincipalName === "string"
        ? connCfg.graphMailboxUserPrincipalName
        : null,
  });
  const url = `${viewBase}?startDateTime=${encodeURIComponent(
    input.rangeStart.toISOString(),
  )}&endDateTime=${encodeURIComponent(input.rangeEnd.toISOString())}&$top=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) throw new Error(`Microsoft list events failed: ${res.status}`);
  const body = (await res.json()) as {
    value?: {
      id?: string;
      subject?: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      attendees?: { emailAddress?: { address?: string } }[];
    }[];
  };
  const out: MicrosoftCalendarEvent[] = [];
  for (const ev of body.value || []) {
    if (!ev.id) continue;
    const startIso = ev.start?.dateTime;
    const endIso = ev.end?.dateTime;
    if (!startIso || !endIso) continue;
    out.push({
      id: ev.id,
      subject: ev.subject || "Appointment",
      startIso,
      endIso,
      attendeeEmail: ev.attendees?.[0]?.emailAddress?.address,
    });
  }
  return out;
}

export async function microsoftPatchEventTimes(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  eventId: string;
  startIso: string;
  endIso: string;
}): Promise<void> {
  const verify = await import("./microsoft-scheduling-verify-mock");
  if (verify.isMicrosoftSchedulingVerifyMock()) {
    await verify.verifyMockPatchEventTimes();
    return;
  }
  const token = await getMicrosoftAccessToken(input.workspaceId, input.connectionId);
  const url = `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(input.eventId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      start: { dateTime: input.startIso, timeZone: "UTC" },
      end: { dateTime: input.endIso, timeZone: "UTC" },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Microsoft patch event failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

export async function microsoftDeleteEvent(input: {
  workspaceId: string;
  connectionId: string;
  eventId: string;
}): Promise<void> {
  const verify = await import("./microsoft-scheduling-verify-mock");
  if (verify.isMicrosoftSchedulingVerifyMock()) {
    await verify.verifyMockDeleteEvent();
    return;
  }
  const token = await getMicrosoftAccessToken(input.workspaceId, input.connectionId);
  const url = `https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(input.eventId)}`;
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Microsoft delete event failed: ${res.status}`);
  }
}
