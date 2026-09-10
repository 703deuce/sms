import { listWebhookDeliveries } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const deliveries = await listWebhookDeliveries(workspaceId);
    return deliveries;
  });
}
