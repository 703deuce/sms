import { listPaymentPlans, upsertPaymentPlan } from "@/lib/appointments/service-booking/payment-plans";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => listPaymentPlans(workspaceId));
}

export async function POST(request: Request) {
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => upsertPaymentPlan(workspaceId, body));
}
