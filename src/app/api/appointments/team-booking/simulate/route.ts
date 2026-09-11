import { simulateTeamAvailability } from "@/lib/appointments/team-booking/team-availability-simulator";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function POST(request: Request) {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const body = (await request.json()) as {
      serviceName?: string;
      date?: string;
      locationId?: string;
      preferredLeadStaffId?: string;
    };
    if (!body.serviceName || !body.date) throw new Error("serviceName and date required");
    return simulateTeamAvailability(workspaceId, {
      serviceName: body.serviceName,
      date: body.date,
      locationId: body.locationId,
      preferredLeadStaffId: body.preferredLeadStaffId,
    });
  });
}
