import type { ProviderCalendarEvent } from "@/lib/calendar/providers";

export function eventLocationText(event: ProviderCalendarEvent): string {
  const loc = event.locationDisplay?.trim();
  if (loc) return loc;
  const legacy = (event as { location?: string }).location?.trim();
  return legacy || "";
}

export function buildAppointmentEventSourceTexts(event: ProviderCalendarEvent): string[] {
  const subject = (event.summary || "").trim();
  const description = event.description || "";
  const location = eventLocationText(event);
  const attendeeBlob = (event.attendees || [])
    .map((a) => `${a.name || ""} ${a.email || ""}`.trim())
    .filter(Boolean)
    .join("\n");
  return [subject, description, location, attendeeBlob, event.organizerEmail || ""].filter(Boolean);
}
