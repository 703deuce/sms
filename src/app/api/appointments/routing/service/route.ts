import { listAppointmentTypes, upsertAppointmentType } from "@/lib/appointments";
import {
  decodeRoutingPolicy,
  encodeStaffAssignment,
  normalizeStaffRouting,
} from "@/lib/appointments/routing/routing-model";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import type {
  AutoAssignmentMethod,
  CustomerStaffSelectionMode,
  AppointmentTypeConfig,
} from "@/lib/appointments/types";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function PATCH(request: Request) {
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) => {
    const body = (await request.json()) as {
      typeId: string;
      useWorkspaceRoutingDefault?: boolean;
      customerSelection?: CustomerStaffSelectionMode;
      autoMethod?: AutoAssignmentMethod;
      staffPriorityOrder?: string[];
      allowAnyAvailable?: boolean;
    };
    if (!body.typeId) throw new Error("typeId is required");

    const rows = await listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true });
    const row = rows.find((r: { id: string }) => r.id === body.typeId);
    if (!row) throw new Error("Service not found");

    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const prevCfg = (row.config || {}) as AppointmentTypeConfig;
    const nextCfg: AppointmentTypeConfig = { ...prevCfg };

    if (body.useWorkspaceRoutingDefault !== undefined) {
      nextCfg.useWorkspaceRoutingDefault = body.useWorkspaceRoutingDefault;
    }

    if (body.useWorkspaceRoutingDefault) {
      const ws = normalizeStaffRouting(platform.staffRouting);
      nextCfg.staffAssignment = encodeStaffAssignment(
        ws.defaultCustomerSelection || "auto_assign_hidden",
        ws.defaultAutoMethod || "round_robin",
      );
    } else if (body.customerSelection && body.autoMethod) {
      nextCfg.staffAssignment = encodeStaffAssignment(body.customerSelection, body.autoMethod);
      nextCfg.allowAnyAvailable =
        body.allowAnyAvailable ?? body.customerSelection === "customer_may_choose_or_any";
    }

    if (body.staffPriorityOrder) {
      nextCfg.staffPriorityOrder = body.staffPriorityOrder;
    }

    const data = await upsertAppointmentType(workspaceId, {
      id: row.id,
      name: row.name,
      durationMinutes: row.durationMinutes,
      bufferMinutes: row.bufferMinutes,
      calendarId: row.calendarId,
      config: nextCfg,
    });

    return {
      service: data,
      decoded: decodeRoutingPolicy(nextCfg, platform.staffRouting || {}),
    };
  });
}
