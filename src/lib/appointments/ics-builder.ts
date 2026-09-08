/**
 * Build RFC 5545 ICS calendar attachments for appointment reminder emails.
 */
function resolveOrganizerEmail(override?: string): string {
  if (override?.trim()) return override.trim();
  return (
    process.env.APPOINTMENTS_FROM_EMAIL?.trim() ||
    process.env.BREVO_FROM_EMAIL?.trim() ||
    "appointments@transovo.local"
  );
}

export function buildIcsAttachment(input: {
  summary: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  organizerName: string;
  organizerEmail?: string;
  location?: string;
  description?: string;
  manageUrl?: string;
  uid?: string;
}): string {
  const format = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const uid = input.uid || `${Date.now()}@transovo.ai`;
  const organizerEmail = resolveOrganizerEmail(input.organizerEmail);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Transovo//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${format(new Date())}`,
    `DTSTART:${format(input.startsAt)}`,
    `DTEND:${format(input.endsAt)}`,
    `SUMMARY:${escapeIcs(input.summary)}`,
    `ORGANIZER;CN=${escapeIcs(input.organizerName)}:MAILTO:${organizerEmail}`,
  ];
  if (input.location) lines.push(`LOCATION:${escapeIcs(input.location)}`);
  const descriptionParts = [input.description].filter(Boolean);
  if (input.manageUrl) descriptionParts.push(`Manage appointment: ${input.manageUrl}`);
  const description = descriptionParts.join("\\n");
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  if (input.manageUrl) lines.push(`URL:${escapeIcs(input.manageUrl)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
