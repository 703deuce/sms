import "server-only";

import { getPrisma } from "@/lib/server/db";

type CalendarConfig = Record<string, unknown>;

async function getGoogleAccessToken(workspaceId: string, connectionId: string): Promise<string> {
  const row = await getPrisma().voiceCalendarConnection.findFirst({
    where: { id: connectionId, workspaceId, provider: "google" },
  });
  if (!row) throw new Error("Google calendar connection not found");
  const config = (row.config || {}) as CalendarConfig;
  const access = typeof config.accessToken === "string" ? config.accessToken : "";
  const expiresAt = typeof config.expiresAt === "number" ? config.expiresAt : 0;
  if (access && expiresAt > Date.now() + 60_000) return access;

  const refresh = typeof config.refreshToken === "string" ? config.refreshToken : "";
  if (!refresh) throw new Error("Google refresh token missing — reconnect calendar");

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error("Google OAuth env not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  const body = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new Error("Google token refresh returned no access_token");

  const nextConfig = {
    ...config,
    accessToken: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  await getPrisma().voiceCalendarConnection.update({
    where: { id: connectionId },
    data: { config: nextConfig },
  });
  return body.access_token;
}

export async function googleFreeBusy(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<{ start: string; end: string }[]> {
  const token = await getGoogleAccessToken(input.workspaceId, input.connectionId);
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      timeMin: input.rangeStart.toISOString(),
      timeMax: input.rangeEnd.toISOString(),
      items: [{ id: input.calendarId }],
    }),
  });
  if (!res.ok) throw new Error(`Google freeBusy failed: ${res.status}`);
  const body = (await res.json()) as {
    calendars?: Record<string, { busy?: { start?: string; end?: string }[] }>;
  };
  const busy = body.calendars?.[input.calendarId]?.busy || [];
  return busy.map((b) => ({ start: b.start || "", end: b.end || "" })).filter((x) => x.start && x.end);
}

export async function googleCreateEvent(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  summary: string;
  startIso: string;
  endIso: string;
  attendeeEmail?: string;
}): Promise<{ id: string }> {
  const token = await getGoogleAccessToken(input.workspaceId, input.connectionId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.summary,
        start: { dateTime: input.startIso, timeZone: "UTC" },
        end: { dateTime: input.endIso, timeZone: "UTC" },
        attendees: input.attendeeEmail ? [{ email: input.attendeeEmail }] : undefined,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google create event failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { id?: string };
  if (!body.id) throw new Error("Google create event missing id");
  return { id: body.id };
}

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  startIso: string;
  endIso: string;
  attendeeEmail?: string;
  attendeePhone?: string;
};

export async function googleListEvents(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<GoogleCalendarEvent[]> {
  const token = await getGoogleAccessToken(input.workspaceId, input.connectionId);
  const params = new URLSearchParams({
    timeMin: input.rangeStart.toISOString(),
    timeMax: input.rangeEnd.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "50",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Google list events failed: ${res.status}`);
  const body = (await res.json()) as {
    items?: {
      id?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      attendees?: { email?: string; displayName?: string }[];
      description?: string;
    }[];
  };
  const out: GoogleCalendarEvent[] = [];
  for (const ev of body.items || []) {
    if (!ev.id) continue;
    const startIso = ev.start?.dateTime || ev.start?.date;
    const endIso = ev.end?.dateTime || ev.end?.date;
    if (!startIso || !endIso) continue;
    const attendee = ev.attendees?.[0];
    out.push({
      id: ev.id,
      summary: ev.summary || "Appointment",
      startIso,
      endIso,
      attendeeEmail: attendee?.email,
      attendeePhone: ev.description?.match(/\+?1?\d{10,11}/)?.[0],
    });
  }
  return out;
}

export async function googlePatchEventTimes(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  eventId: string;
  startIso: string;
  endIso: string;
}): Promise<void> {
  const token = await getGoogleAccessToken(input.workspaceId, input.connectionId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { dateTime: input.startIso, timeZone: "UTC" },
        end: { dateTime: input.endIso, timeZone: "UTC" },
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google patch event failed: ${res.status} ${text.slice(0, 200)}`);
  }
}

export async function googleDeleteEvent(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  eventId: string;
}): Promise<void> {
  const token = await getGoogleAccessToken(input.workspaceId, input.connectionId);
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`Google delete event failed: ${res.status}`);
  }
}
