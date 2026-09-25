/** Midnight (start of local day) for an IANA timezone. */
export function startOfDayInTimezone(timezone: string, now = new Date()): Date {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    const guess = new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
      minute: "numeric",
    }).formatToParts(guess);
    const hour = Number(local.find((p) => p.type === "hour")?.value || 0);
    const minute = Number(local.find((p) => p.type === "minute")?.value || 0);
    return new Date(guess.getTime() - (hour * 60 + minute) * 60_000);
  } catch {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
}
