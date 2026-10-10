/** Canonical Appointment Reminders product routes (compact standalone app). */
export const AR_ROUTES = {
  home: "/appointment-reminders",
  appointments: "/appointment-reminders/appointments",
  /** Read-only grid synced from connected provider calendars */
  calendar: "/appointment-reminders/calendar",
  reminders: "/appointment-reminders/reminders",
  analytics: "/appointment-reminders/analytics",
  /** OAuth, import selection, and sync settings */
  calendars: "/appointment-reminders/calendars",
  settings: "/appointment-reminders/settings",
  aiRescheduler: "/appointment-reminders/ai-rescheduler",
  /** Customer response inbox (held queue is `?view=held`) */
  responses: "/appointment-reminders/responses",
  /** @deprecated use AR_ROUTES.responses?view=held */
  heldInbound: "/appointment-reminders/held-inbound",
  booking: "/appointment-reminders/booking",
  bookingServices: "/appointment-reminders/booking/services",
  bookingMeetings: "/appointment-reminders/booking/meetings",
  setupConnect: "/appointment-reminders/setup/connect",
  setupConfigure: "/appointment-reminders/setup/configure",
  setupActivate: "/appointment-reminders/setup/activate",
} as const;

export function appointmentRemindersShellHome(): string {
  return AR_ROUTES.home;
}

/** Settings deep links (canonical calendar management → Integrations tab). */
export function arSettingsTab(tab: string): string {
  return `${AR_ROUTES.settings}?tab=${encodeURIComponent(tab)}`;
}

export const AR_SETTINGS_INTEGRATIONS = arSettingsTab("integrations");

export function isAppointmentRemindersProductPath(pathname: string): boolean {
  return pathname === AR_ROUTES.home || pathname.startsWith(`${AR_ROUTES.home}/`);
}
