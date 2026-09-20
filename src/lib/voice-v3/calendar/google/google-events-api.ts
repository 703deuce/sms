import "server-only";

import type { ProviderCalendarEvent } from "@/lib/calendar/providers";

type GoogleEventItem = {
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
};

function mapGoogleItem(item: GoogleEventItem): ProviderCalendarEvent {
  const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
  const startRaw = item.start?.dateTime || item.start?.date;
  const endRaw = item.end?.dateTime || item.end?.date;
  const start = startRaw
    ? new Date(isAllDay ? `${startRaw}T00:00:00Z` : startRaw)
    : new Date();
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
}

export function googleEventBlocksAvailability(event: GoogleEventItem): boolean {
  if (event.status === "cancelled") return false;
  if (event.transparency === "transparent") return false;
  return true;
}

export async function listGoogleCalendarEventsPaginated(input: {
  accessToken: string;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
  timeZone: string;
  showDeleted?: boolean;
}): Promise<GoogleEventItem[]> {
  const calendarId = input.calendarId || "primary";
  const items: GoogleEventItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    );
    url.searchParams.set("timeMin", input.timeMin.toISOString());
    url.searchParams.set("timeMax", input.timeMax.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("showDeleted", input.showDeleted ? "true" : "false");
    url.searchParams.set("timeZone", input.timeZone);
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
    if (!res.ok) {
      throw new Error(`Google events.list ${res.status}`);
    }
    const json = (await res.json()) as {
      items?: GoogleEventItem[];
      nextPageToken?: string;
    };
    items.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
  } while (pageToken);

  return items;
}

export async function getGoogleCalendarEventRaw(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
}): Promise<GoogleEventItem | null> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      input.calendarId || "primary",
    )}/events/${encodeURIComponent(input.eventId)}`,
    { headers: { Authorization: `Bearer ${input.accessToken}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Google events.get ${res.status}`);
  return (await res.json()) as GoogleEventItem;
}

export async function insertGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  body: Record<string, unknown>;
  sendUpdates?: "all" | "externalOnly" | "none";
}): Promise<string> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      input.calendarId || "primary",
    )}/events`,
  );
  if (input.sendUpdates) url.searchParams.set("sendUpdates", input.sendUpdates);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  if (!res.ok) throw new Error(`Google events.insert ${res.status}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("Google events.insert missing id");
  return json.id;
}

export async function replaceGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  body: Record<string, unknown>;
  sendUpdates?: "all" | "externalOnly" | "none";
}): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      input.calendarId || "primary",
    )}/events/${encodeURIComponent(input.eventId)}`,
  );
  if (input.sendUpdates) url.searchParams.set("sendUpdates", input.sendUpdates);

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input.body),
  });
  if (!res.ok) throw new Error(`Google events.update ${res.status}`);
}

export async function deleteGoogleCalendarEvent(input: {
  accessToken: string;
  calendarId: string;
  eventId: string;
  sendUpdates?: "all" | "externalOnly" | "none";
}): Promise<void> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      input.calendarId || "primary",
    )}/events/${encodeURIComponent(input.eventId)}`,
  );
  if (input.sendUpdates) url.searchParams.set("sendUpdates", input.sendUpdates);

  const res = await fetch(url.toString(), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${input.accessToken}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google events.delete ${res.status}`);
  }
}

export function mapGoogleEventToProvider(event: GoogleEventItem): ProviderCalendarEvent {
  return mapGoogleItem(event);
}
