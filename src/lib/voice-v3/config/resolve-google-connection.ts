export type GoogleCalendarConnectionRow = {
  id: string;
  name: string | null;
};

/**
 * Deterministic Google calendar connection pick for Voice V3.
 * Explicit wizard calendarEmail match wins; otherwise first row in stable input order.
 */
export function resolveGoogleConnectionForWizard(
  connections: GoogleCalendarConnectionRow[],
  calendarEmail: string | null | undefined,
): GoogleCalendarConnectionRow | null {
  if (connections.length === 0) return null;
  const email = calendarEmail?.trim();
  if (email) {
    const match = connections.find((c) => (c.name ?? "").trim() === email);
    if (match) return match;
  }
  return connections[0];
}
