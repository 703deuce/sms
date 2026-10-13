import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { isImportedCalendarAppointmentRow } from "@/lib/appointment-reminders/calendar/ar-calendar-import-filter";

function isReschedulableCalendarEventId(id: string) {
  if (id.startsWith("class:") || id.startsWith("video:") || id.startsWith("meeting:")) return false;
  if (id.startsWith("block:") || id.startsWith("external:")) return false;
  return true;
}

/** Provider-imported rows (Microsoft/Google sync) — not native Transovo bookings. */
export function isImportedCalendarApiEvent(ev: CalendarApiAppointment): boolean {
  return isImportedCalendarAppointmentRow({
    externalId: (ev.metadata as { externalId?: string })?.externalId ?? null,
    metadata: ev.metadata as AppointmentMetadata | undefined,
  });
}

/** Drag/reschedule in Opus calendar — native bookings only; not classes/video/imported provider events. */
export function isOpusNativeCalendarEventDraggable(ev: CalendarApiAppointment): boolean {
  if (!isReschedulableCalendarEventId(ev.id)) return false;
  const status = ev.status?.toLowerCase();
  if (status === "canceled" || status === "cancelled") return false;
  if (isImportedCalendarApiEvent(ev)) return false;
  return true;
}
