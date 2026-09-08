import {
  listCustomerFieldDefinitions,
  upsertCustomerFieldDefinition,
  deleteCustomerFieldDefinition,
  getContactCustomFieldValues,
  setContactCustomFieldValues,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contactId = url.searchParams.get("contactId");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (contactId) {
      return getContactCustomFieldValues(workspaceId, contactId);
    }
    return listCustomerFieldDefinitions(workspaceId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "delete") {
      return deleteCustomerFieldDefinition(workspaceId, body.id);
    }
    if (body.action === "set_values") {
      return setContactCustomFieldValues(workspaceId, body.contactId, body.values);
    }
    return upsertCustomerFieldDefinition(workspaceId, body);
  });
}
