import { listAppointmentTypes, upsertAppointmentType } from "@/lib/appointments";
import type { AppointmentTypeConfig } from "@/lib/appointments/types";
import type { TeamBookingServiceConfig } from "@/lib/appointments/team-booking/types";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function PATCH(request: Request) {
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) => {
    const body = (await request.json()) as {
      typeId: string;
      teamBooking?: TeamBookingServiceConfig;
      enableCollectiveLegacy?: boolean;
      collectiveStaffIds?: string[];
    };
    if (!body.typeId) throw new Error("typeId required");
    const rows = await listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true });
    const row = rows.find((r: { id: string }) => r.id === body.typeId);
    if (!row) throw new Error("Service not found");

    const nextCfg: AppointmentTypeConfig = { ...(row.config || {}) };
    if (body.teamBooking) {
      nextCfg.teamBooking = { ...nextCfg.teamBooking, ...body.teamBooking };
      if (body.teamBooking.enabled) {
        nextCfg.staffAssignment = "collective";
      }
    }
    if (body.collectiveStaffIds) {
      nextCfg.collectiveStaffIds = body.collectiveStaffIds;
    }
    if (body.enableCollectiveLegacy) {
      nextCfg.staffAssignment = "collective";
    }

    const data = await upsertAppointmentType(workspaceId, {
      id: row.id,
      name: row.name,
      durationMinutes: row.durationMinutes,
      bufferMinutes: row.bufferMinutes,
      calendarId: row.calendarId,
      config: nextCfg,
    });
    return { service: data };
  });
}
