import { listServicePhaseTemplates, upsertServicePhaseTemplate } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const appointmentTypeId = new URL(request.url).searchParams.get("appointmentTypeId") || undefined;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listServicePhaseTemplates(workspaceId, appointmentTypeId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertServicePhaseTemplate(workspaceId, body),
  );
}
