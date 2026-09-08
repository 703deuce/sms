import { listSchedulingResources, upsertSchedulingResource } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listSchedulingResources(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertSchedulingResource(workspaceId, body),
  );
}
