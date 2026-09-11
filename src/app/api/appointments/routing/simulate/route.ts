import { simulateRouting } from "@/lib/appointments/routing/routing-simulator";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function POST(request: Request) {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const body = (await request.json()) as {
      serviceName?: string;
      startsAt?: string;
      locationId?: string;
      preferredStaffId?: string;
    };
    if (!body.serviceName || !body.startsAt) {
      throw new Error("serviceName and startsAt are required");
    }
    return simulateRouting(workspaceId, {
      serviceName: body.serviceName,
      startsAt: body.startsAt,
      locationId: body.locationId,
      preferredStaffId: body.preferredStaffId,
    });
  });
}
