/** Appointments V1 route prefixes — shared shell routes included. */
export const APPOINTMENTS_APP_ROUTE_PREFIXES = [
  "/appointments",
  "/meetings",
  "/conversations",
  "/contacts",
  "/analytics",
  "/numbers",
  "/compliance",
  "/integrations",
  "/settings",
  "/help",
] as const;

export function isAppointmentsProductPath(pathname: string): boolean {
  if (pathname === "/appointments" || pathname.startsWith("/appointments/")) return true;
  return APPOINTMENTS_APP_ROUTE_PREFIXES.some(
    (p) => p !== "/appointments" && (pathname === p || pathname.startsWith(`${p}/`)),
  );
}

export function appointmentsShellHome(): string {
  return "/appointments/overview";
}

/** Static first-level segments under /appointments — not appointment detail IDs. */
export const APPOINTMENTS_STATIC_SEGMENTS = new Set([
  "overview",
  "calendar",
  "types",
  "availability",
  "staff",
  "locations",
  "routing",
  "integrations",
  "reminders",
  "voice-reminders",
  "workflows",
  "meetings",
  "booking",
  "setup",
  "analytics",
  "new",
]);

/** Nav active check: /appointments list + detail IDs only — not /appointments/calendar etc. */
export function isAppointmentsScheduledNavActive(pathname: string): boolean {
  if (pathname === "/appointments") return true;
  const match = pathname.match(/^\/appointments\/([^/]+)$/);
  if (!match) return false;
  return !APPOINTMENTS_STATIC_SEGMENTS.has(match[1]);
}

export function isAppointmentsNavItemActive(href: string, pathname: string): boolean {
  if (href === "/appointments") {
    return isAppointmentsScheduledNavActive(pathname);
  }
  if (pathname === href) return true;
  if (href === "/appointments/overview" && pathname === "/appointments") return false;
  return pathname.startsWith(`${href}/`);
}
