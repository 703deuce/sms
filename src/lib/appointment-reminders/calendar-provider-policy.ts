import "server-only";

/** Microsoft 365-first launch: hide Google for new AR calendar connections when enabled. */
export function appointmentRemindersMicrosoftOnlyLaunch(): boolean {
  const raw = process.env.AR_MICROSOFT_ONLY_CALENDAR?.trim();
  if (raw === "0" || raw === "false") return false;
  if (raw === "1" || raw === "true") return true;
  return true;
}

export function isCalendarProviderAllowedForAppointmentReminders(provider: string): boolean {
  if (provider === "microsoft") return true;
  if (provider === "google") return !appointmentRemindersMicrosoftOnlyLaunch();
  return false;
}
