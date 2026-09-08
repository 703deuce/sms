import {
  listHouseholdAccounts,
  createHouseholdAccount,
  addHouseholdMember,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const payerContactId = new URL(request.url).searchParams.get("payerContactId") || undefined;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listHouseholdAccounts(workspaceId, payerContactId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "add_member") {
      return addHouseholdMember(body.householdId, body.contactId, body);
    }
    return createHouseholdAccount(workspaceId, body.payerContactId, body.name);
  });
}
