const ALLOWED_RETURN_PREFIXES = [
  "/appointments/calendar",
  "/appointments/overview",
  "/appointments/scheduled",
  "/appointments/waitlist",
  "/conversations",
  "/appointments/clients",
  "/appointments/point-of-sale",
  "/appointments/forms-documents",
];

export function sanitizeReturnTo(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//") || trimmed.includes("://")) return null;
  if (trimmed.includes("..")) return null;
  const path = trimmed.split("?")[0] || trimmed;
  if (!ALLOWED_RETURN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    return null;
  }
  return trimmed;
}

export function appendReturnTo(href: string, returnTo: string | null): string {
  if (!returnTo) return href;
  const safe = sanitizeReturnTo(returnTo);
  if (!safe) return href;
  const sep = href.includes("?") ? "&" : "?";
  return `${href}${sep}returnTo=${encodeURIComponent(safe)}`;
}

export function calendarReturnLabel(returnTo: string | null): string {
  if (!returnTo) return "Back";
  if (returnTo.startsWith("/appointments/calendar")) return "Back to Calendar";
  return "Back";
}
