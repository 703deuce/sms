/** Canonical SMS messaging surfaces exposed inside Appointments (no forked routes). */
export const APPOINTMENTS_INBOX_PATH = "/conversations";
export const APPOINTMENTS_CAMPAIGNS_PATH = "/campaigns";

export const APPOINTMENTS_MESSAGES_PATH_PREFIXES = [
  APPOINTMENTS_INBOX_PATH,
  APPOINTMENTS_CAMPAIGNS_PATH,
] as const;

export function isAppointmentsMessagesPath(pathname: string): boolean {
  return APPOINTMENTS_MESSAGES_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
