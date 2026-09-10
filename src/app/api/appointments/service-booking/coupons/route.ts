import { listCoupons, upsertCoupon, validateAndApplyCoupon } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => listCoupons(workspaceId));
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "preview") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
      const { listCoupons } = await import("@/lib/appointments/service-booking/coupons");
      const coupons = await listCoupons(workspaceId);
      const coupon = coupons.find(
        (c: { code: string; active: boolean }) =>
          c.code === String(body.code || "").trim().toUpperCase() && c.active,
      );
      if (!coupon) throw new Error("Invalid coupon");
      const baseCents = Number(body.baseCents || 0);
      const discountCents =
        coupon.discountType === "percent"
          ? Math.round((baseCents * coupon.discountValue) / 100)
          : Math.min(baseCents, coupon.discountValue);
      return { coupon, discountCents, totalCents: Math.max(0, baseCents - discountCents) };
    });
  }
  if (body.action === "apply") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      validateAndApplyCoupon(workspaceId, body.code, body),
    );
  }
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertCoupon(workspaceId, body),
  );
}
