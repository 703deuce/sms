import "server-only";

import { listAppointments } from "@/lib/appointments/appointments-service";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import type { CalendarApiAppointment } from "@/features/appointments/kimi/calendar/map-calendar";
import { parseImportedExternalId } from "@/lib/calendar/external-id";
import { isImportedCalendarAppointmentRow } from "@/lib/appointment-reminders/calendar/ar-calendar-import-filter";
import { listWorkspaceCalendarEvents } from "@/lib/calendar/workspace-calendar-events";
import { isUnifiedAppointmentsExperience } from "@/lib/products/unified-appointments";

export type ArCalendarEventsQuery = {
  from: Date;
  to: Date;
  q?: string;
  status?: string;
  staffIds?: string[];
  locationId?: string;
  resourceId?: string;
  domainType?: string;
};

function mapStatus(status: string): string {
  const s = status.toLowerCase();
  if (s === "cancelled" || s === "canceled") return "canceled";
  return s === "scheduled" ? "scheduled" : status;
}

/**
 * Appointment Reminders calendar: imported / synced workspace appointments only (provider-neutral shape).
 */
export async function listAppointmentRemindersCalendarEvents(
  workspaceId: string,
  query: ArCalendarEventsQuery,
): Promise<CalendarApiAppointment[]> {
  if (isUnifiedAppointmentsExperience()) {
    return listWorkspaceCalendarEvents(workspaceId, {
      from: query.from,
      to: query.to,
      filters: {
        q: query.q,
        status: query.status || "all",
        staffIds: query.staffIds,
        locationId: query.locationId,
        resourceId: query.resourceId,
        domainType: query.domainType || "all",
      },
    });
  }

  const [appointments, platform] = await Promise.all([
    listAppointments(workspaceId, {
      from: query.from,
      to: query.to,
      take: 500,
    }),
    loadAppointmentPlatformConfig(workspaceId),
  ]);

  const q = query.q?.trim().toLowerCase();
  const statusFilter = query.status && query.status !== "all" ? query.status.toLowerCase() : null;

  const rows: CalendarApiAppointment[] = [];
  for (const row of appointments) {
    const meta = (row.metadata || {}) as AppointmentMetadata;
    const externalId = row.externalId || "";
    const parsed = externalId ? parseImportedExternalId(externalId) : null;
    if (!isImportedCalendarAppointmentRow(row)) continue;

    const status = mapStatus(row.status);
    if (statusFilter === "canceled" && status !== "canceled") continue;
    if (statusFilter === "scheduled" && status === "canceled") continue;

    const title = row.serviceName || row.inviteeName || "Appointment";
    if (q) {
      const hay = `${title} ${row.inviteeName || ""} ${row.inviteePhone || ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }

    rows.push({
      id: row.id,
      eventKind: "appointment",
      domainType: "service",
      inviteeName: row.inviteeName,
      inviteePhone: row.inviteePhone,
      serviceName: row.serviceName || title,
      startsAt: new Date(row.startsAt as string | Date).toISOString(),
      endsAt: row.endsAt ? new Date(row.endsAt as string | Date).toISOString() : null,
      status,
      timezone: row.timezone || platform.timezone || null,
      metadata: {
        ...(meta as Record<string, unknown>),
        connectionId: parsed?.connectionId || meta.connectionId,
        provider: parsed?.provider || meta.provider,
        providerEventId: parsed?.eventId || (meta as { providerEventId?: string }).providerEventId,
        sourceEventUrl: (meta as { sourceEventUrl?: string }).sourceEventUrl,
      },
      contactId: row.contactId,
    });
  }

  return rows.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
}
