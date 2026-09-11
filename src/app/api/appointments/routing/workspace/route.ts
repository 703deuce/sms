import { buildRoutingWorkspace } from "@/lib/appointments/routing/routing-workspace";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    return buildRoutingWorkspace(workspaceId);
  });
}
