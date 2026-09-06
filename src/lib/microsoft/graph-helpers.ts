import "server-only";

/** Microsoft Graph v1.0 base URL. */
export const MICROSOFT_GRAPH_V1 = "https://graph.microsoft.com/v1.0";

/** Standard Prefer header for UTC event times in Graph calendar responses. */
export const GRAPH_PREFER_OUTLOOK_UTC = 'outlook.timezone="UTC"';

/**
 * Outlook calendar event change notifications — max subscription lifetime is 10,080 minutes (7 days).
 * @see https://learn.microsoft.com/en-us/graph/change-notifications-overview#subscription-lifetime
 */
export const OUTLOOK_EVENT_SUBSCRIPTION_MAX_MINUTES = 10_080;

/** Resource path for delegated Outlook event subscriptions. */
export const OUTLOOK_EVENTS_SUBSCRIPTION_RESOURCE = "me/events";

/**
 * Compute a subscription expiration within Microsoft's documented Outlook event limit.
 * @see https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions
 */
export function outlookEventSubscriptionExpiration(fromMs = Date.now()): string {
  const bufferMinutes = 15;
  const lifetimeMs = (OUTLOOK_EVENT_SUBSCRIPTION_MAX_MINUTES - bufferMinutes) * 60_000;
  return new Date(fromMs + lifetimeMs).toISOString();
}

/**
 * Format a point in time for Graph dateTimeTimeZone (no offset suffix; timeZone is separate).
 * @see https://learn.microsoft.com/en-us/graph/api/resources/datetimetimezone
 */
export function toMicrosoftDateTimeTimeZone(
  date: Date,
  timeZone = "UTC",
): { dateTime: string; timeZone: string } {
  const dateTime = date.toISOString().replace(/\.\d{3}Z$/, "");
  return { dateTime, timeZone };
}

/** Parse Graph dateTime values returned with Prefer: outlook.timezone="UTC". */
export function parseMicrosoftGraphDateTime(dateTime: string, timeZone = "UTC"): Date {
  if (!dateTime) return new Date();
  if (/[zZ]$/.test(dateTime) || /[+-]\d{2}:\d{2}$/.test(dateTime)) {
    return new Date(dateTime);
  }
  if (timeZone.toUpperCase() === "UTC") {
    return new Date(`${dateTime}Z`);
  }
  return new Date(dateTime);
}

/** Parse calendar event start/end including all-day `{ date }` values. */
export function parseMicrosoftEventDateTime(
  value?: { dateTime?: string; date?: string; timeZone?: string },
  isAllDay?: boolean,
): Date {
  if (value?.date && (isAllDay || !value.dateTime)) {
    return new Date(`${value.date}T00:00:00Z`);
  }
  return parseMicrosoftGraphDateTime(value?.dateTime || "", value?.timeZone || "UTC");
}

/**
 * Whether a calendarView event blocks availability.
 * workingElsewhere is treated as free per getSchedule docs.
 * @see https://learn.microsoft.com/en-us/graph/api/calendar-getschedule
 */
export function isMicrosoftBusyShowAs(showAs?: string): boolean {
  if (!showAs) return true;
  return !["free", "workingElsewhere"].includes(showAs);
}

/** Whether a getSchedule scheduleItem blocks availability. */
export function isMicrosoftBusyScheduleStatus(status?: string): boolean {
  if (!status) return false;
  return ["busy", "tentative", "oof"].includes(status);
}

/** Build a calendarView URL per Graph list-calendarView docs. */
export function microsoftCalendarViewUrl(calendarId?: string): string {
  if (calendarId) {
    return `${MICROSOFT_GRAPH_V1}/me/calendars/${encodeURIComponent(calendarId)}/calendarView`;
  }
  return `${MICROSOFT_GRAPH_V1}/me/calendar/calendarView`;
}

export type MicrosoftGraphCollectionPage<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
};
