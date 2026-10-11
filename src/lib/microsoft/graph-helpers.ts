import "server-only";

export {
  formatInstantAsGraphLocalWallDateTime,
  isUtcTimeZoneId,
  resolveMicrosoftGraphTimeZoneId,
  toMicrosoftDateTimeTimeZone,
} from "./graph-datetime-timezone";

/** Microsoft Graph v1.0 base URL. */
export const MICROSOFT_GRAPH_V1 = "https://graph.microsoft.com/v1.0";

/**
 * Tenant id for personal Microsoft accounts (Outlook.com / Hotmail).
 * Delegated getSchedule is not supported for this tenant.
 * @see https://learn.microsoft.com/en-us/graph/api/calendar-getschedule
 */
export const MICROSOFT_PERSONAL_ACCOUNT_TENANT_ID = "9188040d-6c67-4c5b-b112-36a304b66dad";

export type MicrosoftAccountType = "personal" | "organizational" | "unknown";

/**
 * Infer account type from a known Microsoft tenant id.
 * Returns unknown when tenant metadata is missing — never assume personal.
 */
export function inferMicrosoftAccountType(tenantId?: string | null): MicrosoftAccountType {
  if (!tenantId) return "unknown";
  if (tenantId.toLowerCase() === MICROSOFT_PERSONAL_ACCOUNT_TENANT_ID) return "personal";
  return "organizational";
}

/** Resolve stored + inferred account type for capability decisions. */
export function resolveMicrosoftAccountType(input?: {
  accountType?: MicrosoftAccountType | null;
  tenantId?: string | null;
}): MicrosoftAccountType {
  if (input?.accountType && input.accountType !== "unknown") return input.accountType;
  if (input?.tenantId) return inferMicrosoftAccountType(input.tenantId);
  return input?.accountType || "unknown";
}

/** Whether delegated POST /me/calendar/getSchedule is supported for this connection. */
export function canUseMicrosoftGetSchedule(accountType?: MicrosoftAccountType | null): boolean {
  return accountType === "organizational";
}

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

function microsoftGraphUserPrefix(mailboxUserPrincipalName?: string): string {
  const upn = mailboxUserPrincipalName?.trim();
  if (!upn) return `${MICROSOFT_GRAPH_V1}/me`;
  return `${MICROSOFT_GRAPH_V1}/users/${encodeURIComponent(upn)}`;
}

/** Build a calendarView URL per Graph list-calendarView docs. */
export function microsoftCalendarViewUrl(
  calendarId?: string,
  mailboxUserPrincipalName?: string,
): string {
  const user = microsoftGraphUserPrefix(mailboxUserPrincipalName);
  if (calendarId) {
    return `${user}/calendars/${encodeURIComponent(calendarId)}/calendarView`;
  }
  return `${user}/calendar/calendarView`;
}

export type MicrosoftGraphCollectionPage<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

/** Normalized Microsoft Graph error for diagnostics (never includes tokens). */
export type MicrosoftGraphError = {
  provider: "microsoft";
  httpStatus: number;
  graphCode?: string;
  graphMessage?: string;
  requestId?: string;
};

/** Parse a failed Graph response into a sanitized error shape. */
export async function parseMicrosoftGraphError(res: Response): Promise<MicrosoftGraphError> {
  const requestId = res.headers.get("request-id") || res.headers.get("client-request-id") || undefined;
  let graphCode: string | undefined;
  let graphMessage: string | undefined;
  try {
    const json = (await res.clone().json()) as {
      error?: { code?: string; message?: string };
    };
    graphCode = json.error?.code;
    graphMessage = json.error?.message;
  } catch {
    graphMessage = await res.text().catch(() => res.statusText);
  }
  return {
    provider: "microsoft",
    httpStatus: res.status,
    graphCode,
    graphMessage,
    requestId,
  };
}

/** Build a calendarView delta URL for incremental event sync. */
export function microsoftCalendarViewDeltaUrl(
  calendarId?: string,
  mailboxUserPrincipalName?: string,
): string {
  const user = microsoftGraphUserPrefix(mailboxUserPrincipalName);
  if (calendarId) {
    return `${user}/calendars/${encodeURIComponent(calendarId)}/calendarView/delta`;
  }
  return `${user}/calendar/calendarView/delta`;
}
