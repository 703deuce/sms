/** Appointments V1 route prefixes — shared shell routes included. */
export const APPOINTMENTS_APP_ROUTE_PREFIXES = [
  "/appointments",
  "/meetings",
  "/video",
  "/payments",
  "/conversations",
  "/contacts",
  "/analytics",
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
  "routing-forms",
  "integrations",
  "reminders",
  "voice-reminders",
  "workflows",
  "meetings",
  "booking",
  "setup",
  "analytics",
  "new",
  "waitlist",
  "polls",
  "recalls",
  "recall-campaigns",
  "no-show-recovery",
  "team-pages",
  "enterprise",
  "ai-booking",
  "automations",
]);

/** Route prefixes grouped by appointments-platform work domain (for nav active state). */
export const APPOINTMENTS_DOMAIN_PREFIXES: Record<string, string[]> = {
  appointments: [
    "/appointments/calendar",
    "/appointments/waitlist",
    "/appointments/recalls",
    "/appointments/recall-campaigns",
    "/appointments/no-show-recovery",
  ],
  booking: [
    "/appointments/types",
    "/appointments/booking",
    "/appointments/team-pages",
    "/appointments/availability",
    "/appointments/ai-booking",
    "/appointments/routing-forms",
    "/appointments/routing",
    "/appointments/polls",
  ],
  automations: [
    "/appointments/reminders",
    "/appointments/voice-reminders",
    "/appointments/workflows",
    "/appointments/automations",
  ],
  meetings: ["/video", "/meetings"],
  payments: ["/payments"],
  analytics: ["/appointments/analytics"],
  integrations: ["/integrations/calendars", "/integrations/payments"],
  settings: ["/settings"],
};

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

export function pathnameMatchesAppointmentsDomain(
  domain: keyof typeof APPOINTMENTS_DOMAIN_PREFIXES,
  pathname: string,
): boolean {
  const prefixes = APPOINTMENTS_DOMAIN_PREFIXES[domain];
  if (domain === "appointments" && isAppointmentsScheduledNavActive(pathname)) return true;
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
