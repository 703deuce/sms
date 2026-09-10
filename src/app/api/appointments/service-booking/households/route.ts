import {
  listHouseholdAccounts,
  createHouseholdAccount,
  addHouseholdMember,
  resolveHouseholdForContact,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const payerContactId = url.searchParams.get("payerContactId") || undefined;
  const contactId = url.searchParams.get("contactId") || undefined;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (contactId) return resolveHouseholdForContact(workspaceId, contactId);
    return listHouseholdAccounts(workspaceId, payerContactId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "add_member") {
      return addHouseholdMember(body.householdId, body.contactId, body);
    }
    if (body.action === "create_named" || (!body.payerContactId && body.name)) {
      const { getPrisma } = await import("@/lib/db");
      const prisma = getPrisma();
      const contact = await prisma.contact.create({
        data: {
          workspaceId,
          firstName: String(body.name).trim(),
          phone: `+1555${Date.now().toString().slice(-7)}`,
        },
      });
      return createHouseholdAccount(workspaceId, contact.id, String(body.name).trim());
    }
    return createHouseholdAccount(workspaceId, body.payerContactId, body.name);
  });
}
