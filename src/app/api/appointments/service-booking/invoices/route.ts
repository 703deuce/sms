import { createInvoice, listInvoices } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contactId") || undefined;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listInvoices(workspaceId, contactId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    createInvoice(workspaceId, body),
  );
}
