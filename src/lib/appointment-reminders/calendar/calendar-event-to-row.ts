import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import type { ArAppointmentRow } from "@/lib/appointment-reminders/appointments-page-types";
import { eventSubtitle, eventTitle, looksLikePhoneOnly } from "@/lib/appointment-reminders/calendar/ar-calendar-layout";

/** Minimal row for detail drawer until full list payload is loaded. */
export function calendarEventToAppointmentRow(
  ev: CalendarApiAppointment,
  timezone: string,
): ArAppointmentRow {
  const meta = ev.metadata || {};
  const primary = eventTitle(ev);
  const secondary = eventSubtitle(ev);
  const rawName = ev.inviteeName?.trim() || "";
  const rawService = ev.serviceName?.trim() || "";
  const customerName =
    rawName && !looksLikePhoneOnly(rawName)
      ? rawName
      : primary !== "Appointment"
        ? primary
        : rawName || rawService || "Customer";
  const appointmentTitle = secondary || (rawService && !looksLikePhoneOnly(rawService) ? rawService : primary);
  return {
    id: ev.id,
    customerName,
    appointmentTitle,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt ?? null,
    timezone: ev.timezone ?? timezone,
    isAllDay: Boolean(meta.isAllDay),
    phone: ev.inviteePhone ?? null,
    phoneState: "ok",
    contactEmail: (meta.inviteeEmail as string) || null,
    reminder: {
      status: "scheduled",
      label: "Reminders",
      secondaryLine: "",
    },
    customerResponse: {
      kind: "none",
      label: "No reply",
      detailLine: undefined,
      reasonLine: undefined,
    },
    sourceProvider: (meta.provider as string) || null,
    sourceCalendarLabel: null,
    connectionId: (meta.connectionId as string) || null,
    status: ev.status,
    sourceEventUrl: null,
  };
}
