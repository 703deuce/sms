/** Calendar connection is usable for appointment import / reminders (provider-agnostic status strings). */
export function isCalendarConnectionUsable(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return s === "connected" || s === "active" || s === "verified" || s === "ok";
}
