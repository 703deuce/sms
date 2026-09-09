import {
  cancelClassEnrollment,
  getClassOccurrenceDetail,
  updateClassOccurrence,
} from "@/lib/appointments/service-booking/classes";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const detail = await getClassOccurrenceDetail(workspaceId, id);
    if (!detail) throw new Error("Occurrence not found");
    return detail;
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "cancel_enrollment") {
      return cancelClassEnrollment(workspaceId, body.enrollmentId);
    }
    return updateClassOccurrence(workspaceId, id, {
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      capacity: body.capacity,
      status: body.status,
    });
  });
}
