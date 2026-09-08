import { listCoupons, upsertCoupon, validateAndApplyCoupon } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => listCoupons(workspaceId));
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "apply") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      validateAndApplyCoupon(workspaceId, body.code, body),
    );
  }
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertCoupon(workspaceId, body),
  );
}
