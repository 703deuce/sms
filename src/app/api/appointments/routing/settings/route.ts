import { saveAppointmentPlatformConfig, loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { normalizeStaffRouting } from "@/lib/appointments/routing/routing-model";
import type { StaffRoutingConfig } from "@/lib/appointments/types";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function PATCH(request: Request) {
  return withAppointmentsAuth("appointments.settings.manage", async ({ workspaceId }) => {
    const body = (await request.json()) as {
      staffRouting?: StaffRoutingConfig;
      workspaceStaffPriorityOrder?: string[];
    };
    const platform = await loadAppointmentPlatformConfig(workspaceId);
    const prev = normalizeStaffRouting(platform.staffRouting);
    const next: StaffRoutingConfig = {
      ...prev,
      ...body.staffRouting,
    };
    if (body.workspaceStaffPriorityOrder) {
      next.workspaceStaffPriorityOrder = body.workspaceStaffPriorityOrder;
    }
    await saveAppointmentPlatformConfig(workspaceId, { staffRouting: next });
    return { staffRouting: normalizeStaffRouting(next) };
  });
}
