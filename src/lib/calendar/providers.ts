import { getPrisma } from "@/lib/db";
import type { CalendarImportRules } from "@/lib/calendar/eligibility";
import { refreshMicrosoftAccessToken } from "@/lib/microsoft/oauth-config";
import {
  addCalendarDays,
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "@/lib/voice/calendar/timezone-slots";

export type CalendarConfig = {
  provider?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  /** Google calendar id or Microsoft calendar id for reads/writes */
  calendarId?: string;
  /** Google calendar ids used for availability blocking */
  blockingCalendarIds?: string[];
  /** Google/Microsoft calendar ids to import events from */
  importCalendarIds?: string[];
  /** Google/Microsoft calendar id that receives Transovo-created events */
  writeCalendarId?: string;
  syncEnabled?: boolean;
  syncLookbackDays?: number;
  syncLookaheadDays?: number;
  lastSyncError?: string | null;
  importRules?: CalendarImportRules;
  /** Microsoft Graph subscription id + expiry */
  microsoftSubscription?: { id: string; expiresAt: string; resource?: string };
  /** Google Calendar watch channel */
  googleWatchChannels?: Array<{ calendarId: string; channelId: string; resourceId: string; expiresAt: string }>;
  timezone?: string;
  webhookUrl?: string;
  email?: string;
  displayName?: string;
  lastVerifiedAt?: string;
  lastVerificationOk?: boolean;
  lastVerificationError?: string | null;
};

export type BusyInterval = { start: Date; end: Date };

export type ProviderCalendar = { id: string; name: string; primary?: boolean };

/** Whether a connection has usable OAuth tokens for live calendar access. */
export function hasOAuthTokens(config: CalendarConfig | null | undefined) {
  return Boolean(config?.accessToken || config?.refreshToken);
}

export function resolveWriteCalendarId(config: CalendarConfig) {
  return config.writeCalendarId || config.calendarId || "primary";
}

export function resolveBlockingCalendarIds(config: CalendarConfig, provider: string) {
  if (config.blockingCalendarIds?.length) return config.blockingCalendarIds;
  if (provider === "google") return [config.calendarId || "primary"];
  return [];
}

/**
 * Return a valid access token, refreshing via the stored refresh token when the
 * current one is missing/expired, and persisting the new token on the row.
 */
export async function getValidAccessToken(
  connectionId: string,
  provider: string,
  config: CalendarConfig,
): Promise<string | null> {
  const notExpired = config.expiresAt && config.expiresAt > Date.now() + 60_000;
  if (config.accessToken && notExpired) return config.accessToken;
  if (!config.refreshToken) return config.accessToken || null;

  try {
    const refreshed =
      provider === "microsoft"
        ? await refreshMicrosoft(config.refreshToken)
        : await refreshGoogle(config.refreshToken);
    if (!refreshed) return config.accessToken || null;

    const newConfig: CalendarConfig = {
      ...config,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || config.refreshToken,
      expiresAt: Date.now() + refreshed.expiresIn * 1000,
    };
    await getPrisma().voiceCalendarConnection.update({
      where: { id: connectionId },
      data: { config: newConfig as object },
    });
    return refreshed.accessToken;
  } catch (err) {
    console.warn("[calendar] token refresh failed", connectionId, err);
    await getPrisma().voiceCalendarConnection.update({
      where: { id: connectionId },
      data: { status: "needs_reauth" },
    }).catch(() => undefined);
    return config.accessToken || null;
  }
}

async function refreshGoogle(refreshToken: string) {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return {
    accessToken: json.access_token as string,
    refreshToken: json.refresh_token as string | undefined,
    expiresIn: (json.expires_in as number) || 3600,
  };
}

async function refreshMicrosoft(refreshToken: string) {
  const refreshed = await refreshMicrosoftAccessToken(refreshToken);
  if (!refreshed?.access_token) return null;
  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresIn: refreshed.expires_in || 3600,
  };
}

// --- Calendar listing ----------------------------------------------------

export async function getGoogleCalendars(accessToken: string): Promise<ProviderCalendar[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google calendarList ${res.status}`);
  const json = await res.json();
  const items = (json.items || []) as Array<{ id: string; summary?: string; primary?: boolean }>;
  return items.map((item) => ({
    id: item.id,
    name: item.summary || item.id,
    primary: Boolean(item.primary),
  }));
}

export async function getMicrosoftCalendars(accessToken: string): Promise<ProviderCalendar[]> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,isDefaultCalendar", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Microsoft calendars ${res.status}`);
  const json = await res.json();
  const items = (json.value || []) as Array<{ id: string; name?: string; isDefaultCalendar?: boolean }>;
  return items.map((item) => ({
    id: item.id,
    name: item.name || item.id,
    primary: Boolean(item.isDefaultCalendar),
  }));
}

// --- Busy lookups --------------------------------------------------------

export async function getGoogleBusy(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId || "primary" }],
    }),
  });
  if (!res.ok) throw new Error(`Google freeBusy ${res.status}`);
  const json = await res.json();
  const cal = json.calendars?.[calendarId || "primary"];
  const busy = (cal?.busy || []) as Array<{ start: string; end: string }>;
  return busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function getMicrosoftBusy(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId?: string,
): Promise<BusyInterval[]> {
  const base = calendarId
    ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`
    : "https://graph.microsoft.com/v1.0/me/calendarView";
  const url = new URL(base);
  url.searchParams.set("startDateTime", timeMin.toISOString());
  url.searchParams.set("endDateTime", timeMax.toISOString());
  url.searchParams.set("$select", "start,end,showAs");
  url.searchParams.set("$top", "250");
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!res.ok) throw new Error(`Microsoft calendarView ${res.status}`);
  const json = await res.json();
  const events = (json.value || []) as Array<{
    start: { dateTime: string };
    end: { dateTime: string };
    showAs?: string;
  }>;
  return events
    .filter((e) => e.showAs !== "free")
    .map((e) => ({
      start: new Date(`${e.start.dateTime}Z`.replace(/Z+$/, "Z")),
      end: new Date(`${e.end.dateTime}Z`.replace(/Z+$/, "Z")),
    }));
}

export type ProviderCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
  timezone?: string;
  status: "confirmed" | "cancelled";
  attendees?: Array<{ email?: string; name?: string; responseStatus?: string }>;
  organizerEmail?: string;
  updatedAt?: Date;
  isAllDay?: boolean;
  transovoOriginated?: boolean;
};

export function resolveImportCalendarIds(config: CalendarConfig) {
  return config.importCalendarIds || [];
}

export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<ProviderCalendarEvent[]> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events`,
  );
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("showDeleted", "true");
  url.searchParams.set("maxResults", "250");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google events.list ${res.status}`);
  const json = await res.json();
  const items = (json.items || []) as Array<{
    id: string;
    status?: string;
    summary?: string;
    description?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    updated?: string;
    attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>;
    organizer?: { email?: string };
    transparency?: string;
    extendedProperties?: { private?: Record<string, string> };
  }>;

  return items
    .filter((item) => item.transparency !== "transparent")
    .map((item) => {
      const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
      const startRaw = item.start?.dateTime || item.start?.date;
      const endRaw = item.end?.dateTime || item.end?.date;
      const start = startRaw ? new Date(isAllDay ? `${startRaw}T00:00:00Z` : startRaw) : new Date();
      const end = endRaw
        ? new Date(isAllDay ? `${endRaw}T00:00:00Z` : endRaw)
        : new Date(start.getTime() + 30 * 60_000);
      return {
        id: item.id,
        summary: item.summary || "Calendar event",
        description: item.description,
        start,
        end,
        timezone: item.start?.timeZone,
        status: item.status === "cancelled" ? "cancelled" : "confirmed",
        attendees: (item.attendees || []).map((a) => ({
          email: a.email,
          name: a.displayName,
          responseStatus: a.responseStatus,
        })),
        organizerEmail: item.organizer?.email,
        updatedAt: item.updated ? new Date(item.updated) : undefined,
        isAllDay,
        transovoOriginated: Boolean(item.extendedProperties?.private?.transovoAppointmentId),
      };
    });
}

export async function getGoogleCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<ProviderCalendarEvent | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Google events.get ${res.status}`);
  const item = await res.json();
  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
  const startRaw = item.start?.dateTime || item.start?.date;
  const endRaw = item.end?.dateTime || item.end?.date;
  const start = startRaw ? new Date(isAllDay ? `${startRaw}T00:00:00Z` : startRaw) : new Date();
  const end = endRaw
    ? new Date(isAllDay ? `${endRaw}T00:00:00Z` : endRaw)
    : new Date(start.getTime() + 30 * 60_000);
  return {
    id: item.id,
    summary: item.summary || "Calendar event",
    description: item.description,
    start,
    end,
    timezone: item.start?.timeZone,
    status: item.status === "cancelled" ? "cancelled" : "confirmed",
    attendees: (item.attendees || []).map((a: { email?: string; displayName?: string; responseStatus?: string }) => ({
      email: a.email,
      name: a.displayName,
      responseStatus: a.responseStatus,
    })),
    organizerEmail: item.organizer?.email,
    updatedAt: item.updated ? new Date(item.updated) : undefined,
    isAllDay,
    transovoOriginated: Boolean(item.extendedProperties?.private?.transovoAppointmentId),
  };
}

export async function getMicrosoftCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<ProviderCalendarEvent | null> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Microsoft events.get ${res.status}`);
  const item = await res.json();
  if (item.showAs === "free") return null;
  return {
    id: item.id,
    summary: item.subject || "Calendar event",
    description: item.bodyPreview,
    start: new Date(`${item.start.dateTime}Z`.replace(/Z+$/, "Z")),
    end: new Date(`${item.end.dateTime}Z`.replace(/Z+$/, "Z")),
    timezone: item.start?.timeZone,
    status: item.isCancelled ? "cancelled" : "confirmed",
    attendees: (item.attendees || []).map((a: { emailAddress?: { address?: string; name?: string }; status?: { response?: string } }) => ({
      email: a.emailAddress?.address,
      name: a.emailAddress?.name,
      responseStatus: a.status?.response,
    })),
    organizerEmail: item.organizer?.emailAddress?.address,
    updatedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
    isAllDay: Boolean(item.isAllDay),
    transovoOriginated: false,
  };
}

export async function listMicrosoftCalendarEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
  calendarId?: string,
): Promise<ProviderCalendarEvent[]> {
  const base = calendarId
    ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView`
    : "https://graph.microsoft.com/v1.0/me/calendarView";
  const url = new URL(base);
  url.searchParams.set("startDateTime", timeMin.toISOString());
  url.searchParams.set("endDateTime", timeMax.toISOString());
  url.searchParams.set(
    "$select",
    "id,subject,bodyPreview,start,end,isCancelled,showAs,attendees,organizer,lastModifiedDateTime,isAllDay",
  );
  url.searchParams.set("$top", "250");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!res.ok) throw new Error(`Microsoft events.list ${res.status}`);
  const json = await res.json();
  const items = (json.value || []) as Array<{
    id: string;
    subject?: string;
    bodyPreview?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    isCancelled?: boolean;
    showAs?: string;
    isAllDay?: boolean;
    lastModifiedDateTime?: string;
    attendees?: Array<{ emailAddress?: { address?: string; name?: string }; status?: { response?: string } }>;
    organizer?: { emailAddress?: { address?: string } };
  }>;

  return items
    .filter((item) => item.showAs !== "free")
    .map((item) => ({
      id: item.id,
      summary: item.subject || "Calendar event",
      description: item.bodyPreview,
      start: new Date(`${item.start.dateTime}Z`.replace(/Z+$/, "Z")),
      end: new Date(`${item.end.dateTime}Z`.replace(/Z+$/, "Z")),
      timezone: item.start.timeZone,
      status: item.isCancelled ? "cancelled" : "confirmed",
      attendees: (item.attendees || []).map((a) => ({
        email: a.emailAddress?.address,
        name: a.emailAddress?.name,
        responseStatus: a.status?.response,
      })),
      organizerEmail: item.organizer?.emailAddress?.address,
      updatedAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
      isAllDay: Boolean(item.isAllDay),
      transovoOriginated: false,
    }));
}

// --- Event create / update / delete --------------------------------------

export async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    timezone?: string;
    transovoAppointmentId?: string;
  },
): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.start.toISOString(), timeZone: event.timezone || "UTC" },
        end: { dateTime: event.end.toISOString(), timeZone: event.timezone || "UTC" },
        extendedProperties: event.transovoAppointmentId
          ? { private: { transovoAppointmentId: event.transovoAppointmentId } }
          : undefined,
      }),
    },
  );
  if (!res.ok) throw new Error(`Google events.insert ${res.status}`);
  const json = await res.json();
  return (json.id as string) || null;
}

export async function updateGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  event: { summary?: string; description?: string; start?: Date; end?: Date; timezone?: string },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (event.summary !== undefined) body.summary = event.summary;
  if (event.description !== undefined) body.description = event.description;
  if (event.start) {
    body.start = { dateTime: event.start.toISOString(), timeZone: event.timezone || "UTC" };
  }
  if (event.end) {
    body.end = { dateTime: event.end.toISOString(), timeZone: event.timezone || "UTC" };
  }
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Google events.update ${res.status}`);
}

export async function deleteGoogleEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId || "primary")}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!res.ok && res.status !== 404) throw new Error(`Google events.delete ${res.status}`);
}

export async function insertMicrosoftEvent(
  accessToken: string,
  event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    timezone?: string;
    calendarId?: string;
  },
): Promise<string | null> {
  const url = event.calendarId
    ? `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(event.calendarId)}/events`
    : "https://graph.microsoft.com/v1.0/me/events";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subject: event.summary,
      body: { contentType: "text", content: event.description || "" },
      start: { dateTime: event.start.toISOString(), timeZone: event.timezone || "UTC" },
      end: { dateTime: event.end.toISOString(), timeZone: event.timezone || "UTC" },
    }),
  });
  if (!res.ok) throw new Error(`Microsoft events.insert ${res.status}`);
  const json = await res.json();
  return (json.id as string) || null;
}

export async function updateMicrosoftEvent(
  accessToken: string,
  eventId: string,
  event: { summary?: string; description?: string; start?: Date; end?: Date; timezone?: string },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (event.summary !== undefined) body.subject = event.summary;
  if (event.description !== undefined) {
    body.body = { contentType: "text", content: event.description };
  }
  if (event.start) {
    body.start = { dateTime: event.start.toISOString(), timeZone: event.timezone || "UTC" };
  }
  if (event.end) {
    body.end = { dateTime: event.end.toISOString(), timeZone: event.timezone || "UTC" };
  }
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Microsoft events.update ${res.status}`);
}

export async function deleteMicrosoftEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok && res.status !== 404) throw new Error(`Microsoft events.delete ${res.status}`);
}

/**
 * Compute open slots within business hours (9-17 local) over `days`, excluding
 * any busy intervals returned by the provider.
 */
export function computeFreeSlots(
  busy: BusyInterval[],
  durationMinutes: number,
  days: number,
  now = new Date(),
  bufferMinutes = 0,
  opts?: {
    timezone?: string;
    startHour?: number;
    endHour?: number;
    weekdaysOnly?: boolean;
  },
): Array<{ startsAt: string; endsAt: string }> {
  const bufferMs = bufferMinutes * 60_000;
  const slots: Array<{ startsAt: string; endsAt: string }> = [];
  const tz = (opts?.timezone || "").trim();
  const startHour = opts?.startHour ?? 9;
  const endHour = opts?.endHour ?? 17;
  const weekdaysOnly = opts?.weekdaysOnly ?? true;

  if (tz) {
    const today = zonedDateParts(now, tz);
    for (let d = 0; d < days; d += 1) {
      const day = addCalendarDays(today.year, today.month, today.day, d);
      const noon = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, 12, 0);
      const weekday = zonedDateParts(noon, tz).weekday;
      if (weekdaysOnly && (weekday === "sat" || weekday === "sun")) continue;
      for (let hour = startHour; hour < endHour; hour += 1) {
        const start = wallTimeInZoneToUtc(tz, day.year, day.month, day.day, hour, 0);
        const end = new Date(start.getTime() + durationMinutes * 60_000);
        if (start <= now) continue;
        const overlaps = busy.some((b) => {
          const bufferedStart = new Date(b.start.getTime() - bufferMs);
          const bufferedEnd = new Date(b.end.getTime() + bufferMs);
          return start < bufferedEnd && end > bufferedStart;
        });
        if (!overlaps) {
          slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
        }
      }
    }
    return slots.slice(0, 20);
  }

  for (let d = 0; d < days; d += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + d);
    if (weekdaysOnly) {
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
    }
    for (let hour = startHour; hour < endHour; hour += 1) {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      if (start <= now) continue;
      const overlaps = busy.some((b) => {
        const bufferedStart = new Date(b.start.getTime() - bufferMs);
        const bufferedEnd = new Date(b.end.getTime() + bufferMs);
        return start < bufferedEnd && end > bufferedStart;
      });
      if (!overlaps) {
        slots.push({ startsAt: start.toISOString(), endsAt: end.toISOString() });
      }
    }
  }
  return slots.slice(0, 20);
}
