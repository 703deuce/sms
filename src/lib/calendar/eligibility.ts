import type { CalendarConfig, ProviderCalendarEvent } from "@/lib/calendar/providers";
import { mergeImportRulesWithMigration } from "@/lib/calendar/import-rules-migration";

export type CalendarImportRules = {
  /** When true (default), skip events with no attendees outside the connected account. */
  requireExternalAttendees?: boolean;
  /** When true, skip events where no attendee/organizer email is available. */
  requireAttendeeEmail?: boolean;
  /** When true (default for AR), only remind on events the connected mailbox organizes. */
  requireOrganizerIsConnection?: boolean;
  /** Skip Microsoft `showAs: free` (and Google transparent) events for SMS eligibility. */
  skipFreeShowAs?: boolean;
  /** Skip tentative events for SMS eligibility. */
  skipTentativeShowAs?: boolean;
  /**
   * When true (default), skip meetings where every external attendee shares the organizer's email domain
   * (typical internal staff-only meetings with no customer).
   */
  skipInternalDomainOnlyMeetings?: boolean;
  /** Substrings that must appear in the event title (case-insensitive). */
  titleIncludePatterns?: string[];
  /** Substrings that exclude the event when matched in title (case-insensitive). */
  titleExcludePatterns?: string[];
  /** Skip all-day events (default true — poor fit for timed reminders). */
  skipAllDay?: boolean;
  /** When true, apply built-in personal/internal title blocklist (opt-in; default false). */
  useBuiltinTitleExcludes?: boolean;
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
    requireExternalAttendees: false,
    requireAttendeeEmail: false,
    requireOrganizerIsConnection: false,
    skipFreeShowAs: false,
    skipTentativeShowAs: false,
    skipInternalDomainOnlyMeetings: false,
    skipAllDay: true,
    useBuiltinTitleExcludes: false,
    titleExcludePatterns: [],
  };
}

export function mergeImportRules(config: CalendarConfig): CalendarImportRules {
  return mergeImportRulesWithMigration(config);
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}

export type ReminderImportConnectionContext = {
  connectionEmail?: string | null;
  microsoftUserId?: string | null;
  /** E.164 customer phone extracted from title/body/contact — solo Outlook entries. */
  customerPhoneE164?: string | null;
};

/**
 * Microsoft Graph often reports the organizer as outlook_{oid}@outlook.com while OAuth
 * stores the mailbox SMTP (e.g. custom domain). Same user must count as connection-organized.
 */
export function organizerMatchesConnection(
  organizerEmail: string | null | undefined,
  context: ReminderImportConnectionContext,
): boolean {
  const organizer = normalizeEmail(organizerEmail);
  const self = normalizeEmail(context.connectionEmail);
  if (!organizer) return true;
  if (self && organizer === self) return true;

  const oid = context.microsoftUserId?.trim().toLowerCase();
  if (!oid) return false;

  const outlookAlias = `outlook_${oid}@outlook.com`;
  if (organizer === outlookAlias) return true;

  const match = organizer.match(/^outlook_([a-f0-9]+)@outlook\.com$/i);
  if (match && match[1].toLowerCase() === oid) return true;

  return false;
}

function emailDomain(email: string): string | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

function isFreeOrTransparentShowAs(showAs?: string | null): boolean {
  const v = (showAs || "").toLowerCase();
  return v === "free" || v === "transparent";
}

function isTentativeShowAs(showAs?: string | null): boolean {
  const v = (showAs || "").toLowerCase();
  return v === "tentative";
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

/**
 * Calendar page mirror — import/display all provider events in the sync window.
 * SMS reminder rules are evaluated separately via isEventEligibleForReminderImport.
 */
export function isEventEligibleForCalendarMirror(
  event: ProviderCalendarEvent,
): { eligible: boolean; reason?: string } {
  if (event.transovoOriginated) {
    return { eligible: false, reason: "transovo_originated" };
  }
  return { eligible: true };
}

export function isEventEligibleForReminderImport(
  event: ProviderCalendarEvent,
  rules: CalendarImportRules,
  connectionEmail?: string | null,
  context?: Omit<ReminderImportConnectionContext, "connectionEmail">,
): { eligible: boolean; reason?: string } {
  const connection: ReminderImportConnectionContext = {
    connectionEmail,
    microsoftUserId: context?.microsoftUserId,
    customerPhoneE164: context?.customerPhoneE164,
  };
  if (rules.skipAllDay !== false && event.isAllDay) {
    return { eligible: false, reason: "all_day" };
  }

  if (event.transovoOriginated) {
    return { eligible: false, reason: "transovo_originated" };
  }

  const title = (event.summary || "").toLowerCase();
  const excludes = [
    ...(rules.useBuiltinTitleExcludes ? DEFAULT_TITLE_EXCLUDES : []),
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

  if (rules.skipFreeShowAs !== false && isFreeOrTransparentShowAs(event.showAs)) {
    return { eligible: false, reason: "show_as_free" };
  }

  if (rules.skipTentativeShowAs && isTentativeShowAs(event.showAs)) {
    return { eligible: false, reason: "show_as_tentative" };
  }

  const self = normalizeEmail(connection.connectionEmail);
  const organizer = normalizeEmail(event.organizerEmail);
  if (
    rules.requireOrganizerIsConnection !== false &&
    self &&
    organizer &&
    !organizerMatchesConnection(event.organizerEmail, connection)
  ) {
    return { eligible: false, reason: "organizer_not_connection" };
  }

  const attendees = externalAttendees(event, connection.connectionEmail);
  const hasCustomerPhone = Boolean(connection.customerPhoneE164?.trim());
  if (rules.requireExternalAttendees !== false && attendees.length === 0 && !hasCustomerPhone) {
    return { eligible: false, reason: "no_external_attendees" };
  }

  if (rules.skipInternalDomainOnlyMeetings !== false && attendees.length > 0) {
    const organizerDomain = emailDomain(organizer || self || "");
    if (organizerDomain) {
      const allSameDomain = attendees.every((a) => {
        const domain = emailDomain(normalizeEmail(a.email));
        return domain === organizerDomain;
      });
      if (allSameDomain) {
        return { eligible: false, reason: "internal_domain_only_attendees" };
      }
    }
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
