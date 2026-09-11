import { buildTeamBookingWorkspace } from "@/lib/appointments/team-booking/team-booking-workspace";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    return buildTeamBookingWorkspace(workspaceId);
  });
}
