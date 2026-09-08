import { listServicePrograms, upsertServiceProgram, enrollContactInProgram } from "@/lib/appointments/service-booking/programs";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => listServicePrograms(workspaceId));
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "enroll") {
      return enrollContactInProgram(workspaceId, body.contactId, body.programId);
    }
    return upsertServiceProgram(workspaceId, body);
  });
}
