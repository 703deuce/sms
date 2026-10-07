/** Canonical Appointment Reminders product routes (compact standalone app). */
export const AR_ROUTES = {
  home: "/appointment-reminders",
  appointments: "/appointment-reminders/appointments",
  reminders: "/appointment-reminders/reminders",
  calendars: "/appointment-reminders/calendars",
  settings: "/appointment-reminders/settings",
  booking: "/appointment-reminders/booking",
  setupConnect: "/appointment-reminders/setup/connect",
  setupActivate: "/appointment-reminders/setup/activate",
} as const;

export function appointmentRemindersShellHome(): string {
  return AR_ROUTES.home;
}

export function isAppointmentRemindersProductPath(pathname: string): boolean {
  return pathname === AR_ROUTES.home || pathname.startsWith(`${AR_ROUTES.home}/`);
}
