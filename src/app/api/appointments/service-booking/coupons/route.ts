import {
  listCoupons,
  upsertCoupon,
  validateAndApplyCoupon,
  getCouponUsageSummary,
  duplicateCoupon,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const couponId = searchParams.get("couponId");
  const usage = searchParams.get("usage");

  if (couponId && usage === "1") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      getCouponUsageSummary(workspaceId, couponId),
    );
  }

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => listCoupons(workspaceId));
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "apply") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      validateAndApplyCoupon(workspaceId, body.code, body),
    );
  }
  if (body.action === "duplicate") {
    return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
      duplicateCoupon(workspaceId, body.couponId),
    );
  }
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertCoupon(workspaceId, body),
  );
}
