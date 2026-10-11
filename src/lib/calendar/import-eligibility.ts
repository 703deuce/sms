import type { AppointmentMetadata } from "@/lib/appointments/types";

/** Reasons set at calendar import — not SMS consent/phone failures. */
export const IMPORT_REMINDER_INELIGIBLE_REASONS = new Set([
  "all_day",
  "transovo_originated",
  "title_excluded",
  "title_not_included",
  "show_as_free",
  "show_as_tentative",
  "organizer_not_connection",
  "no_external_attendees",
  "internal_domain_only_attendees",
  "no_attendee_email",
]);

export function isImportReminderIneligibleReason(reason: string | undefined | null): boolean {
  return Boolean(reason && IMPORT_REMINDER_INELIGIBLE_REASONS.has(reason));
}

/**
 * Appointment-level reminder candidacy (SMS + email discovery).
 * Legacy rows may only have reminderSmsEligible / reminderSmsIneligibleReason.
 */
export function isAppointmentReminderImportEligible(meta: AppointmentMetadata): boolean {
  if (meta.reminderImportEligible === false) return false;
  if (meta.reminderImportEligible === true) return true;

  if (meta.reminderSmsEligible === false) {
    const reason = meta.reminderImportIneligibleReason || meta.reminderSmsIneligibleReason;
    if (isImportReminderIneligibleReason(reason)) return false;
  }

  return true;
}

/** Import rule failure previously called suppressAppointmentReminders — recover on re-sync. */
export function shouldRecoverFromImportOnlySuppression(meta: AppointmentMetadata): boolean {
  if (meta.reminderOverride?.suppressed) return false;
  if (!meta.remindersSuppressed) return false;
  const reason = meta.reminderImportIneligibleReason || meta.reminderSmsIneligibleReason;
  return isImportReminderIneligibleReason(reason);
}
