/**
 * Customer-facing appointment time in the appointment's IANA timezone (never raw UTC clock).
 */
export function resolveArAppointmentDisplayTimezone(input: {
  appointmentTimezone?: string | null;
  metadataTimezone?: string | null;
  platformTimezone?: string | null;
  agentConfigTimezone?: string | null;
}): string {
  const candidates = [
    input.appointmentTimezone,
    input.metadataTimezone,
    input.agentConfigTimezone,
    input.platformTimezone,
    "America/New_York",
  ];
  for (const tz of candidates) {
    const t = (tz || "").trim();
    if (!t) continue;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: t });
      return t;
    } catch {
      /* invalid IANA */
    }
  }
  return "UTC";
}

export function formatArCustomerFacingAppointmentDateTime(
  startUtcIso: string,
  timeZone: string,
): string {
  const instant = new Date(startUtcIso);
  if (Number.isNaN(instant.getTime())) {
    return "your new appointment time";
  }
  const datePart = instant.toLocaleDateString("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timePart = instant.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} at ${timePart}`;
}

export function buildArRescheduleConfirmedSms(startUtcIso: string, timeZone: string): string {
  const when = formatArCustomerFacingAppointmentDateTime(startUtcIso, timeZone);
  return `Your appointment has been rescheduled to ${when}.`;
}
