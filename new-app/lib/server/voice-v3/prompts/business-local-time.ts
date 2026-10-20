/** Application-authoritative business-local clock for Astra (not model-inferred). */
export function formatBusinessLocalDateTime(
  timezone: string,
  now: Date = new Date(),
): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(now);
  } catch {
    return now.toISOString();
  }
}
