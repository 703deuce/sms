import {
  listMembershipProducts,
  upsertMembershipProduct,
  startMembershipSubscription,
  listMembershipSubscriptionsForProduct,
} from "@/lib/appointments/service-booking";
import {
  suspendMembershipForFailedPayment,
  restoreMembershipAfterPaymentRecovery,
  pauseMembershipSubscription,
  resumeMembershipSubscription,
} from "@/lib/appointments/service-booking/membership-lifecycle";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const action = url.searchParams.get("action");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (action === "members" && productId) {
      return listMembershipSubscriptionsForProduct(workspaceId, productId);
    }
    return listMembershipProducts(workspaceId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "subscribe") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      startMembershipSubscription(workspaceId, body.productId, body.contactId, body.stripeSubscriptionId),
    );
  }
  if (body.action === "suspend-failed-payment") {
    return withAppointmentsAuth("appointments.write", async () =>
      suspendMembershipForFailedPayment(body.subscriptionId),
    );
  }
  if (body.action === "recover-payment") {
    return withAppointmentsAuth("appointments.write", async () =>
      restoreMembershipAfterPaymentRecovery(body.subscriptionId),
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
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertMembershipProduct(workspaceId, body),
  );
}
