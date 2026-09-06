import { getPrisma } from "@/lib/db";
import {
  refreshMicrosoftAccessToken,
} from "@/lib/microsoft/oauth-config";
import {
  addCalendarDays,
  wallTimeInZoneToUtc,
  zonedDateParts,
} from "./timezone-slots";

export type CalendarConfig = {
  provider?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  calendarId?: string;
  timezone?: string;
  webhookUrl?: string;
};

export type BusyInterval = { start: Date; end: Date };

function appUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** Whether a connection has usable OAuth tokens for live calendar access. */
export function hasOAuthTokens(config: CalendarConfig | null | undefined) {
  return Boolean(config?.accessToken || config?.refreshToken);
}

async function markCalendarConnectionNeedsReauth(connectionId: string) {
  await getPrisma()
    .voiceCalendarConnection.update({
      where: { id: connectionId },
      data: { status: "needs_reauth" },
    })
    .catch(() => undefined);
}

/**
 * Return a valid access token, refreshing via the stored refresh token when the
 * current one is missing/expired, and persisting the new token on the row.
 */
export async function getValidAccessToken(
  connectionId: string,
  provider: string,
  config: CalendarConfig,
  options?: { forceRefresh?: boolean },
): Promise<string | null> {
  const forceRefresh = options?.forceRefresh ?? false;
  const notExpired =
    !forceRefresh && config.expiresAt && config.expiresAt > Date.now() + 60_000;
  if (config.accessToken && notExpired) return config.accessToken;
  if (!config.refreshToken) {
    if (config.accessToken && notExpired) return config.accessToken;
    return null;
  }

  try {
    const refreshed =
      provider === "microsoft"
        ? await refreshMicrosoft(config.refreshToken)
        : await refreshGoogle(config.refreshToken);
    if (!refreshed) {
      await markCalendarConnectionNeedsReauth(connectionId);
      return null;
    }

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
    await markCalendarConnectionNeedsReauth(connectionId);
    return null;
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
): Promise<BusyInterval[]> {
  const url = new URL("https://graph.microsoft.com/v1.0/me/calendarView");
  url.searchParams.set("startDateTime", timeMin.toISOString());
  url.searchParams.set("endDateTime", timeMax.toISOString());
  url.searchParams.set("$select", "start,end,showAs");
  url.searchParams.set("$top", "100");
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

// --- Event creation ------------------------------------------------------

export async function insertGoogleEvent(
  accessToken: string,
  calendarId: string,
  event: { summary: string; description?: string; start: Date; end: Date; timezone?: string },
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
      }),
    },
  );
  if (!res.ok) throw new Error(`Google events.insert ${res.status}`);
  const json = await res.json();
  return (json.id as string) || null;
}

export async function insertMicrosoftEvent(
  accessToken: string,
  event: { summary: string; description?: string; start: Date; end: Date; timezone?: string },
): Promise<string | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
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
