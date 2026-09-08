import {
  listTreatmentRecords,
  getTreatmentRecord,
  upsertTreatmentRecord,
  deleteTreatmentRecord,
} from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const appointmentId = url.searchParams.get("appointmentId");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (id) return getTreatmentRecord(workspaceId, id);
    if (!appointmentId) throw new Error("appointmentId or id is required");
    return listTreatmentRecords(workspaceId, appointmentId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId, userId }) => {
    if (body.action === "delete") {
      return deleteTreatmentRecord(workspaceId, body.id);
    }
    return upsertTreatmentRecord(workspaceId, {
      ...body,
      createdByUserId: body.createdByUserId ?? userId,
    });
  });
}
