import {
  listMembershipProducts,
  upsertMembershipProduct,
  startMembershipSubscription,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listMembershipProducts(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "subscribe") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      startMembershipSubscription(workspaceId, body.productId, body.contactId, body.stripeSubscriptionId),
    );
  }
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertMembershipProduct(workspaceId, body),
  );
}
