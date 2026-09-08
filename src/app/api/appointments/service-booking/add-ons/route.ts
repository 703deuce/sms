import { listBookingAddOns, upsertBookingAddOn } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => listBookingAddOns(workspaceId));
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertBookingAddOn(workspaceId, body),
  );
}
