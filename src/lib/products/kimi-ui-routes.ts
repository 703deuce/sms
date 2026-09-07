/**
 * Routes promoted from Kimi drafts (mock UI shell). Used for full-bleed layout and
 * hiding duplicate Transovo page chrome so reference.css renders like Kimi preview.
 */

/** Legacy SMS / mass-texting Kimi surfaces. */
const SMS_KIMI_ROUTE_PREFIXES = [
  "/auto-replies",
  "/automations",
  "/campaigns",
  "/contacts",
  "/conversations",
  "/grow/forms",
  "/grow/keywords",
  "/grow/qr-codes",
  "/grow/tap-to-join",
  "/messaging/media",
] as const;

/** Appointments V1 Mode 4 promoted surfaces. */
const APPOINTMENTS_KIMI_ROUTE_PREFIXES = [
  "/appointments",
  "/meetings",
  "/video",
  "/payments",
  "/integrations",
  "/settings",
  "/getting-started",
  "/help",
] as const;

export const KIMI_INTEGRATED_ROUTE_PREFIXES = [
  ...SMS_KIMI_ROUTE_PREFIXES,
  ...APPOINTMENTS_KIMI_ROUTE_PREFIXES,
] as const;

export function isKimiIntegratedRoute(pathname: string): boolean {
  return KIMI_INTEGRATED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** CSS wrapper class for a Kimi-integrated route (matches integrate-kimi-ui JOBS). */
export function kimiRouteScopeClass(pathname: string): string | null {
  if (pathname === "/auto-replies" || pathname.startsWith("/auto-replies/")) {
    return "kimi-auto-replies";
  }
  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) {
    return "kimi-campaigns";
  }
  if (pathname === "/contacts/segments" || pathname.startsWith("/contacts/segments/")) {
    return "kimi-contacts-segments";
  }
  if (pathname === "/grow/forms" || pathname.startsWith("/grow/forms/")) {
    return "kimi-grow-forms";
  }
  if (pathname === "/automations" || pathname.startsWith("/automations/")) {
    return "kimi-automations";
  }
  if (pathname === "/contacts/fields" || pathname.startsWith("/contacts/fields/")) {
    return "kimi-contacts-fields";
  }
  if (pathname === "/contacts/lists" || pathname.startsWith("/contacts/lists/")) {
    return "kimi-contacts-lists";
  }
  if (pathname === "/contacts" || pathname.startsWith("/contacts/")) {
    return "kimi-contacts";
  }
  if (pathname === "/conversations" || pathname.startsWith("/conversations/")) {
    return "kimi-conversations";
  }
  if (pathname === "/grow/keywords" || pathname.startsWith("/grow/keywords/")) {
    return "kimi-grow-keywords";
  }
  if (pathname === "/grow/qr-codes" || pathname.startsWith("/grow/qr-codes/")) {
    return "kimi-grow-qr-codes";
  }
  if (pathname === "/grow/tap-to-join" || pathname.startsWith("/grow/tap-to-join/")) {
    return "kimi-grow-tap-to-join";
  }
  if (pathname === "/messaging/media" || pathname.startsWith("/messaging/media/")) {
    return "kimi-messaging-media";
  }

  // Appointments V1 Mode 4 surfaces
  if (pathname === "/appointments/overview" || pathname.startsWith("/appointments/overview/")) {
    return "kimi-appointments-overview";
  }
  if (pathname === "/appointments/calendar" || pathname.startsWith("/appointments/calendar/")) {
    return "kimi-appointments-calendar";
  }
  if (pathname === "/appointments" || pathname.startsWith("/appointments/")) {
    return "kimi-appointments";
  }
  if (pathname === "/video" || pathname.startsWith("/video/")) {
    return "kimi-meetings-upcoming";
  }
  if (pathname === "/meetings" || pathname.startsWith("/meetings/")) {
    return "kimi-meetings-recaps";
  }
  if (pathname === "/payments" || pathname.startsWith("/payments/")) {
    return "kimi-payments";
  }
  if (pathname === "/integrations/calendars" || pathname.startsWith("/integrations/calendars/")) {
    return "kimi-integrations-calendars";
  }
  if (pathname === "/integrations/payments" || pathname.startsWith("/integrations/payments/")) {
    return "kimi-integrations-payments";
  }
  if (pathname === "/settings" || pathname.startsWith("/settings/")) {
    return "kimi-settings";
  }
  if (pathname === "/getting-started" || pathname.startsWith("/getting-started/")) {
    return "kimi-getting-started";
  }
  if (pathname === "/help" || pathname.startsWith("/help/")) {
    return "kimi-help";
  }

  return null;
}
