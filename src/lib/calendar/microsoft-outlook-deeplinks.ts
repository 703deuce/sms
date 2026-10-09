/**
 * Outlook on the web deep links — convenience URLs, not a Graph API contract.
 * Verify against your Microsoft 365 tenant; parameters may change.
 *
 * @see https://support.microsoft.com/en-us/office/create-and-add-an-appointment-in-outlook-on-the-web-...
 */

/** Opens Microsoft 365 event composer (new appointment). */
export const OUTLOOK_EVENT_COMPOSE_URL = "https://outlook.office.com/calendar/deeplink/compose";

/** Opens Outlook calendar (month view entry). */
export const OUTLOOK_CALENDAR_HOME_URL = "https://outlook.office.com/calendar/";

/** Calendar management in Outlook — create/switch calendars in M365, not in Transovo. */
export const OUTLOOK_CALENDAR_MANAGE_URL = "https://outlook.office.com/calendar/view/month";

export type OutlookComposeParams = {
  subject?: string;
  /** ISO 8601 start (Graph-style local wall optional — verify in tenant). */
  start?: string;
  end?: string;
  body?: string;
};

/**
 * Build compose URL with optional prefill. Unsupported params are ignored by Outlook; safe to omit.
 */
export function buildOutlookEventComposeUrl(params?: OutlookComposeParams): string {
  const url = new URL(OUTLOOK_EVENT_COMPOSE_URL);
  if (params?.subject) url.searchParams.set("subject", params.subject);
  if (params?.start) url.searchParams.set("startdt", params.start);
  if (params?.end) url.searchParams.set("enddt", params.end);
  if (params?.body) url.searchParams.set("body", params.body);
  return url.toString();
}
