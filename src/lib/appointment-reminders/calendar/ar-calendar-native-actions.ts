import "server-only";

import { getPrisma } from "@/lib/db";
import {
  OUTLOOK_CALENDAR_HOME_URL,
  OUTLOOK_CALENDAR_MANAGE_URL,
  OUTLOOK_EVENT_COMPOSE_URL,
  buildOutlookEventComposeUrl,
} from "@/lib/calendar/microsoft-outlook-deeplinks";

export type ArCalendarNativeActions = {
  primaryProvider: "microsoft" | "google" | null;
  microsoft: null | {
    connectionId: string;
    accountEmail: string | null;
    composeUrl: string;
    calendarUrl: string;
    manageCalendarsUrl: string;
  };
  google: null | {
    connectionId: string;
    accountEmail: string | null;
    calendarUrl: string;
    createEventUrl: string;
  };
  syncNote: string;
};

const SYNC_NOTE =
  "Transovo syncs selected calendars in the background. Creating a calendar in Outlook does not import it until you enable it under Calendar connections.";

/**
 * Native provider actions for AR Calendar — Microsoft 365 first; Google adapter later.
 * Uses existing authorized connections only (no new OAuth scopes).
 */
export async function getArCalendarNativeActions(workspaceId: string): Promise<ArCalendarNativeActions> {
  const connections = await getPrisma().voiceCalendarConnection.findMany({
    where: { workspaceId, status: { in: ["connected", "needs_reauth"] } },
    orderBy: { updatedAt: "desc" },
  });

  const ms = connections.find((c) => c.provider === "microsoft" && c.status === "connected");
  const google = connections.find((c) => c.provider === "google" && c.status === "connected");

  const microsoft = ms
    ? {
        connectionId: ms.id,
        accountEmail: ms.accountEmail,
        composeUrl: OUTLOOK_EVENT_COMPOSE_URL,
        calendarUrl: OUTLOOK_CALENDAR_HOME_URL,
        manageCalendarsUrl: OUTLOOK_CALENDAR_MANAGE_URL,
      }
    : null;

  const googleActions = google
    ? {
        connectionId: google.id,
        accountEmail: google.accountEmail,
        calendarUrl: "https://calendar.google.com/calendar/u/0/r",
        createEventUrl: "https://calendar.google.com/calendar/u/0/r/eventedit",
      }
    : null;

  const primaryProvider = microsoft ? "microsoft" : google ? "google" : null;

  return {
    primaryProvider,
    microsoft,
    google: googleActions,
    syncNote: SYNC_NOTE,
  };
}

export { buildOutlookEventComposeUrl };
