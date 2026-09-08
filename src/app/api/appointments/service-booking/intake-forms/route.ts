import { listIntakeForms, upsertIntakeForm, saveIntakeResponse } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const targetKind = new URL(request.url).searchParams.get("targetKind") || undefined;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listIntakeForms(workspaceId, targetKind),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "response") {
      return saveIntakeResponse(workspaceId, body);
    }
    return upsertIntakeForm(workspaceId, body);
  });
}
