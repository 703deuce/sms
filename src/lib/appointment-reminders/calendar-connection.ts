/** Calendar connection is usable for appointment import / reminders (provider-agnostic status strings). */
export function isCalendarConnectionUsable(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return (
    s === "connected" ||
    s === "active" ||
    s === "verified" ||
    s === "ok" ||
    s === "needs_reauth"
  );
}

/** Matches Calendar integrations UI: OAuth is linked (may still need re-auth). */
export function isCalendarConnectionLinked(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s === "connected" || s === "needs_reauth" || isCalendarConnectionUsable(status);
}
