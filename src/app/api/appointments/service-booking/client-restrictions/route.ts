import { listClientRestrictions, upsertClientRestriction } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const contactId = new URL(request.url).searchParams.get("contactId") || undefined;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const rows = await listClientRestrictions(workspaceId);
    if (contactId) return rows.filter((r: { contactId?: string | null }) => r.contactId === contactId);
    return rows;
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId, userId }) =>
    upsertClientRestriction(workspaceId, { ...body, createdByUserId: userId }),
  );
}
