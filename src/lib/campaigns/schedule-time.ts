/**
 * Convert a wall-clock date/time in an IANA timezone to a UTC Date.
 */
export function zonedLocalDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (
    !year ||
    !month ||
    !day ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    !timeZone.trim()
  ) {
    return new Date(`${date}T${time}`);
  }

  let utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = getZonedParts(utc, timeZone);
    const targetMinutes = hour * 60 + minute;
    const actualMinutes = parts.hour * 60 + parts.minute;
    const dayDiff = day - parts.day;
    const diffMinutes = dayDiff * 24 * 60 + (targetMinutes - actualMinutes);
    if (diffMinutes === 0) break;
    utc = new Date(utc.getTime() + diffMinutes * 60 * 1000);
  }

  return utc;
}

export function zonedLocalDateTimeToIso(
  date: string,
  time: string,
  timeZone: string,
): string {
  return zonedLocalDateTimeToUtc(date, time, timeZone).toISOString();
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value || "0");

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}
