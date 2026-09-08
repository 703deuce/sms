import { listPackageProducts, upsertPackageProduct, purchasePackageForContact } from "@/lib/appointments/service-booking";
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
  return withAppointmentsAuth("appointments.types.manage", async ({ workspaceId }) =>
    upsertPackageProduct(workspaceId, body),
  );
}
