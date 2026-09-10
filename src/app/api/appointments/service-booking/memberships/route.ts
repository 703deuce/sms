import {
  listMembershipProducts,
  upsertMembershipProduct,
  startMembershipSubscription,
  listMembershipSubscriptionsForProduct,
  duplicateMembershipProduct,
} from "@/lib/appointments/service-booking/memberships";
import {
  pauseMembershipSubscription,
  resumeMembershipSubscription,
  cancelMembershipSubscription,
} from "@/lib/appointments/service-booking/membership-lifecycle";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  if (productId) {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      listMembershipSubscriptionsForProduct(workspaceId, productId),
    );
  }

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listMembershipProducts(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "subscribe") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      startMembershipSubscription(
        workspaceId,
        body.productId,
        body.contactId,
        body.stripeSubscriptionId,
      ),
    );
  }

  if (body.action === "pause") {
    return withAppointmentsAuth("appointments.write", async () =>
      pauseMembershipSubscription(body.subscriptionId, body.pausedUntil ? new Date(body.pausedUntil) : undefined),
    );
  }

  if (body.action === "resume") {
    return withAppointmentsAuth("appointments.write", async () =>
      resumeMembershipSubscription(body.subscriptionId),
    );
  }

  if (body.action === "cancel") {
    return withAppointmentsAuth("appointments.write", async () =>
      cancelMembershipSubscription(body.subscriptionId, body.mode || "end_of_period"),
    );
  }

  if (body.action === "duplicate") {
    return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
      duplicateMembershipProduct(workspaceId, body.productId),
    );
  }

  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertMembershipProduct(workspaceId, body),
  );
}
