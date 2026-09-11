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
  "/getting-started",
] as const;

/**
 * API prefixes used by Mode 4 Kimi connected surfaces — must bypass legacy SMS/voice
 * product guards in middleware when Appointments V1 is primary.
 */
export const APPOINTMENTS_API_ROUTE_PREFIXES = [
  "/api/appointments",
  "/api/meetings",
  "/api/merchant-payments",
  "/api/calendar",
  "/api/contacts",
  "/api/conversations",
  "/api/templates",
  "/api/team",
  "/api/workspace",
  "/api/settings",
  "/api/messaging",
  "/api/integrations/calendars",
  "/api/integrations/payments",
  "/api/video",
] as const;

export function isAppointmentsProductPath(pathname: string): boolean {
  if (pathname === "/appointments" || pathname.startsWith("/appointments/")) return true;
  return APPOINTMENTS_APP_ROUTE_PREFIXES.some(
    (p) => p !== "/appointments" && (pathname === p || pathname.startsWith(`${p}/`)),
  );
}

export function isAppointmentsApiPath(pathname: string): boolean {
  return APPOINTMENTS_API_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Page or API route belonging to the Appointments V1 platform shell. */
export function isAppointmentsPlatformPath(pathname: string): boolean {
  return isAppointmentsProductPath(pathname) || isAppointmentsApiPath(pathname);
}

export function appointmentsShellHome(): string {
  return "/appointments/overview";
}

/** Static first-level segments under /appointments — not appointment detail IDs. */
export const APPOINTMENTS_STATIC_SEGMENTS = new Set([
  "overview",
  "calendar",
  "types",
  "meetings",
  "services",
  "workshops",
  "classes",
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
  "team-booking",
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
    "/appointments/meetings",
    "/appointments/services",
    "/appointments/classes",
    "/appointments/workshops",
    "/appointments/types",
    "/appointments/booking",
    "/appointments/team-pages",
    "/appointments/team-booking",
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
