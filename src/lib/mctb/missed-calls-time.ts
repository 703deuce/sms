/** Workspace-local missed-call timestamps (display only). */

export function formatMissedCallLocalDateTime(
  isoOrDate: string | Date,
  timeZone: string,
): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString("en-US", {
      timeZone: timeZone || "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

export function formatMissedCallLocalListTime(
  isoOrDate: string | Date,
  timeZone: string,
): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return "—";
  const tz = timeZone || "America/New_York";
  const now = new Date();
  const parts = (date: Date) => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(date);
  };
  const sameDay = parts(d) === parts(now);
  try {
    if (sameDay) {
      return `Today, ${d.toLocaleString("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }
    const datePart = d.toLocaleString("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
    });
    const timePart = d.toLocaleString("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });
    return `${datePart} · ${timePart}`;
  } catch {
    return formatMissedCallLocalDateTime(d, tz);
  }
}
