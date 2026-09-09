import { deleteServicePhaseTemplate } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    deleteServicePhaseTemplate(workspaceId, id),
  );
}
