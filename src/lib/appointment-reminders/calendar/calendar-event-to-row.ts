import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import type { ArAppointmentRow } from "@/lib/appointment-reminders/appointments-page-types";

/** Minimal row for detail drawer until full list payload is loaded. */
export function calendarEventToAppointmentRow(
  ev: CalendarApiAppointment,
  timezone: string,
): ArAppointmentRow {
  const meta = ev.metadata || {};
  return {
    id: ev.id,
    customerName: ev.inviteeName?.trim() || ev.serviceName?.trim() || "Customer",
    appointmentTitle: ev.serviceName?.trim() || "Appointment",
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
