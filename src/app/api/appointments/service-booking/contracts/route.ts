import {
  listContractTemplates,
  upsertContractTemplate,
  issueContractForAppointment,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listContractTemplates(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "issue") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      issueContractForAppointment(workspaceId, body),
    );
  }
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertContractTemplate(workspaceId, body),
  );
}
