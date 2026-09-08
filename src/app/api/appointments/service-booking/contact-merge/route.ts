import { previewContactMerge, mergeContacts } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "merge") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId, userId }) =>
      mergeContacts(workspaceId, body.sourceContactId, body.targetContactId, body.chosenValues || {}, userId),
    );
  }
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    previewContactMerge(workspaceId, body.sourceContactId, body.targetContactId),
  );
}
