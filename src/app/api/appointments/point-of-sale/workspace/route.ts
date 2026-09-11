import { buildPosWorkspace } from "@/lib/appointments/pos/pos-workspace";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    return buildPosWorkspace(workspaceId);
  });
}
