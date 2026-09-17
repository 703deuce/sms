import type { CalendarConfig, ProviderCalendarEvent } from "./calendar-providers";

export type CalendarImportRules = {
  /** When true (default), skip events with no attendees outside the connected account. */
  requireExternalAttendees?: boolean;
  /** When true, skip events where no attendee/organizer email is available. */
  requireAttendeeEmail?: boolean;
  /** Substrings that must appear in the event title (case-insensitive). */
  titleIncludePatterns?: string[];
  /** Substrings that exclude the event when matched in title (case-insensitive). */
  titleExcludePatterns?: string[];
  /** Skip all-day events (default true — poor fit for timed reminders). */
  skipAllDay?: boolean;
};

const DEFAULT_TITLE_EXCLUDES = [
  "ooo",
  "out of office",
  "vacation",
  "pto",
  "lunch",
  "focus time",
  "focus block",
  "do not book",
  "blocked",
  "block ",
  "personal",
  "gym",
  "commute",
  "hold",
];

export function defaultImportRules(): CalendarImportRules {
  return {
    requireExternalAttendees: true,
    requireAttendeeEmail: false,
    skipAllDay: true,
    titleExcludePatterns: [],
  };
}

export function mergeImportRules(config: CalendarConfig): CalendarImportRules {
  return {
    ...defaultImportRules(),
    ...(config.importRules || {}),
  };
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export function externalAttendees(
  event: ProviderCalendarEvent,
  connectionEmail?: string | null,
) {
  const self = normalizeEmail(connectionEmail);
  return (event.attendees || []).filter((a) => {
    const email = normalizeEmail(a.email);
    if (!email) return false;
    if (self && email === self) return false;
    if (a.responseStatus === "declined") return false;
    return true;
  });
}

export function isEventEligibleForReminderImport(
  event: ProviderCalendarEvent,
  rules: CalendarImportRules,
  connectionEmail?: string | null,
): { eligible: boolean; reason?: string } {
  if (rules.skipAllDay !== false && event.isAllDay) {
    return { eligible: false, reason: "all_day" };
  }

  if (event.transovoOriginated) {
    return { eligible: false, reason: "transovo_originated" };
  }

  const title = (event.summary || "").toLowerCase();
  const excludes = [
    ...DEFAULT_TITLE_EXCLUDES,
    ...(rules.titleExcludePatterns || []).map((p) => p.toLowerCase()),
  ];
  if (excludes.some((pattern) => pattern && title.includes(pattern))) {
    return { eligible: false, reason: "title_excluded" };
  }

  if (rules.titleIncludePatterns?.length) {
    const includes = rules.titleIncludePatterns.map((p) => p.toLowerCase());
    if (!includes.some((pattern) => title.includes(pattern))) {
      return { eligible: false, reason: "title_not_included" };
    }
  }

  const attendees = externalAttendees(event, connectionEmail);
  if (rules.requireExternalAttendees !== false && attendees.length === 0) {
    return { eligible: false, reason: "no_external_attendees" };
  }

  const primaryEmail =
    attendees.find((a) => a.email)?.email || event.organizerEmail || undefined;
  if (rules.requireAttendeeEmail && !primaryEmail) {
    return { eligible: false, reason: "no_attendee_email" };
  }

  return { eligible: true };
}

export function shouldImportFromConnection(config: CalendarConfig) {
  return Boolean(config.importCalendarIds?.length) && config.syncEnabled === true;
}
