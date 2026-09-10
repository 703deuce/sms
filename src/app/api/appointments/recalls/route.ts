import {
  dismissRecallCustomer,
  listRecallDueCustomers,
  restoreRecallCustomer,
} from "@/lib/appointments/recalls-due";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listRecallDueCustomers(workspaceId),
  );
}

export async function PATCH(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "dismiss" && body.contactId) {
      return dismissRecallCustomer(workspaceId, body.contactId);
    }
    if (body.action === "restore" && body.contactId) {
      return restoreRecallCustomer(workspaceId, body.contactId);
    }
    throw new Error("action must be dismiss or restore with contactId");
  });
}
