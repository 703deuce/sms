import {
  cancelMembershipSubscription,
  getMembershipProductDetail,
  pauseMembershipSubscription,
  resumeMembershipSubscription,
  upsertMembershipProduct,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const detail = await getMembershipProductDetail(workspaceId, id);
    if (!detail) throw new Error("Membership not found");
    return detail;
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) => {
    if (body.action === "pause_subscription") {
      return pauseMembershipSubscription(body.subscriptionId, body.pausedUntil ? new Date(body.pausedUntil) : undefined);
    }
    if (body.action === "resume_subscription") {
      return resumeMembershipSubscription(body.subscriptionId);
    }
    if (body.action === "cancel_subscription") {
      return cancelMembershipSubscription(body.subscriptionId, body.mode || "immediate");
    }
    return upsertMembershipProduct(workspaceId, { ...body, id });
  });
}
