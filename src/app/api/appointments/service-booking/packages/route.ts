import {
  adjustPackageCredits,
  listPackageProducts,
  purchasePackageForContact,
  upsertPackageProduct,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listPackageProducts(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "purchase") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      purchasePackageForContact(workspaceId, body.productId, body.contactId),
    );
  }
  if (body.action === "adjust_credits") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      adjustPackageCredits(workspaceId, body.balanceId, body.delta, body.note || "Manual adjustment"),
    );
  }
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertPackageProduct(workspaceId, body),
  );
}
