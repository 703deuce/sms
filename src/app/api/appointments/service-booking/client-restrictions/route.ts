import { listClientRestrictions, upsertClientRestriction } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listClientRestrictions(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId, userId }) =>
    upsertClientRestriction(workspaceId, { ...body, createdByUserId: userId }),
  );
}
