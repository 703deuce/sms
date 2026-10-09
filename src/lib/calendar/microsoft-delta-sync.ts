import "server-only";

import { updateWorkspaceCalendarConnection } from "@/lib/calendar/connections";
import {
  callMicrosoftGraph,
  collectMicrosoftGraphCollection,
  getValidAccessToken,
  mapMicrosoftGraphEvent,
  type CalendarConfig,
  type ProviderCalendarEvent,
} from "@/lib/calendar/providers";
import {
  GRAPH_PREFER_OUTLOOK_UTC,
  microsoftCalendarViewDeltaUrl,
  parseMicrosoftGraphError,
} from "@/lib/microsoft/graph-helpers";

type MicrosoftDeltaGraphEvent = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  isCancelled?: boolean;
  showAs?: string;
  isAllDay?: boolean;
  lastModifiedDateTime?: string;
  seriesMasterId?: string;
  type?: string;
  recurrence?: unknown;
  originalStart?: { dateTime?: string; date?: string; timeZone?: string };
  transactionId?: string;
  attendees?: Array<{ emailAddress?: { address?: string; name?: string }; status?: { response?: string } }>;
  organizer?: { emailAddress?: { address?: string } };
  "@removed"?: { reason?: string };
};

export type MicrosoftDeltaSyncResult = {
  events: ProviderCalendarEvent[];
  removedEventIds: string[];
  deltaLink?: string;
  usedFullSync: boolean;
};

function syncWindowMatches(
  stored: { windowStart: string; windowEnd: string } | undefined,
  timeMin: Date,
  timeMax: Date,
) {
  if (!stored) return false;
  return stored.windowStart === timeMin.toISOString() && stored.windowEnd === timeMax.toISOString();
}

function normalizeDeltaEvents(items: MicrosoftDeltaGraphEvent[]): {
  events: ProviderCalendarEvent[];
  removedEventIds: string[];
} {
  const removedEventIds: string[] = [];
  const events: ProviderCalendarEvent[] = [];

  for (const item of items) {
    if (item["@removed"]) {
      removedEventIds.push(item.id);
      events.push({
        id: item.id,
        summary: "Calendar event",
        start: new Date(),
        end: new Date(),
        status: "cancelled",
      });
      continue;
    }
    events.push(mapMicrosoftGraphEvent(item));
  }

  return { events, removedEventIds };
}

/**
 * Incremental Microsoft calendar import via calendarView delta.
 * Persists the full @odata.deltaLink per connection + calendar + sync window.
 * @see https://learn.microsoft.com/en-us/graph/delta-query-events
 */
export async function syncMicrosoftCalendarDelta(input: {
  workspaceId: string;
  connectionId: string;
  calendarId: string;
  config: CalendarConfig;
  timeMin: Date;
  timeMax: Date;
  forceFull?: boolean;
}): Promise<MicrosoftDeltaSyncResult> {
  const { workspaceId, connectionId, calendarId, config, timeMin, timeMax, forceFull } = input;
  const token = await getValidAccessToken(connectionId, "microsoft", config);
  if (!token) throw new Error("Microsoft access token unavailable");

  const ctx = { connectionId, config };
  const stored = config.microsoftDeltaLinks?.[calendarId];
  const canUseDelta =
    !forceFull &&
    stored?.deltaLink &&
    syncWindowMatches(stored, timeMin, timeMax);

  let usedFullSync = !canUseDelta;
  let deltaLink: string | undefined;

  if (canUseDelta && stored?.deltaLink) {
    const deltaPrefer = `${GRAPH_PREFER_OUTLOOK_UTC},odata.maxpagesize=250`;
    const res = await callMicrosoftGraph(token, stored.deltaLink, {
      headers: { Prefer: deltaPrefer },
    }, ctx);

    if (res.status === 410 || res.status === 404) {
      usedFullSync = true;
    } else if (!res.ok) {
      throw new Error(`Microsoft delta sync ${res.status}`);
    } else {
      const { items, deltaLink: nextDeltaLink } = await collectMicrosoftGraphCollection<MicrosoftDeltaGraphEvent>(
        res,
        token,
        ctx,
      );
      deltaLink = nextDeltaLink;
      const normalized = normalizeDeltaEvents(items);
      if (!nextDeltaLink) {
        console.error(
          "[calendar] microsoft delta incremental finished without @odata.deltaLink",
          JSON.stringify({ connectionId, calendarId }),
        );
        throw new Error("Microsoft delta incremental incomplete: missing @odata.deltaLink");
      }
      return {
        events: normalized.events,
        removedEventIds: normalized.removedEventIds,
        deltaLink,
        usedFullSync: false,
      };
    }
  }

  const url = new URL(microsoftCalendarViewDeltaUrl(calendarId));
  url.searchParams.set("startDateTime", timeMin.toISOString());
  url.searchParams.set("endDateTime", timeMax.toISOString());
  // Graph rejects $top on calendarView/delta (ErrorInvalidUrlQuery). Page size via Prefer header.
  const deltaPrefer = `${GRAPH_PREFER_OUTLOOK_UTC},odata.maxpagesize=250`;

  const res = await callMicrosoftGraph(token, url.toString(), {
    headers: { Prefer: deltaPrefer },
  }, ctx);
  if (!res.ok) {
    const graphErr = await parseMicrosoftGraphError(res);
    console.error(
      "[calendar] microsoft delta bootstrap failed",
      JSON.stringify({ connectionId, calendarId, ...graphErr }),
    );
    throw new Error(`Microsoft delta bootstrap ${res.status}`);
  }

  const { items, deltaLink: nextDeltaLink } = await collectMicrosoftGraphCollection<MicrosoftDeltaGraphEvent>(
    res,
    token,
    ctx,
  );
  deltaLink = nextDeltaLink;
  const normalized = normalizeDeltaEvents(items);

  if (!nextDeltaLink && usedFullSync) {
    console.error(
      "[calendar] microsoft delta bootstrap finished without @odata.deltaLink",
      JSON.stringify({
        connectionId,
        calendarId,
        windowStart: timeMin.toISOString(),
        windowEnd: timeMax.toISOString(),
        itemCount: normalized.events.length,
      }),
    );
    throw new Error("Microsoft delta bootstrap incomplete: missing @odata.deltaLink");
  }

  return {
    events: normalized.events,
    removedEventIds: normalized.removedEventIds,
    deltaLink,
    usedFullSync,
  };
}

/** Persist delta checkpoint after appointment rows are durably updated. */
export async function commitMicrosoftDeltaCheckpoint(
  workspaceId: string,
  connectionId: string,
  config: CalendarConfig,
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
  deltaLink: string,
) {
  const microsoftDeltaLinks = {
    ...(config.microsoftDeltaLinks || {}),
    [calendarId]: {
      deltaLink,
      windowStart: timeMin.toISOString(),
      windowEnd: timeMax.toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  await updateWorkspaceCalendarConnection(workspaceId, connectionId, {
    config: { ...config, microsoftDeltaLinks },
  });
  config.microsoftDeltaLinks = microsoftDeltaLinks;
}
