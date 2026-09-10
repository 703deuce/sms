import {
  listPackageProducts,
  upsertPackageProduct,
  purchasePackageForContact,
  listPackageBalancesForProduct,
  getPackageProduct,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const action = url.searchParams.get("action");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (action === "purchases" && productId) {
      return listPackageBalancesForProduct(workspaceId, productId);
    }
    if (productId) {
      const product = await getPackageProduct(workspaceId, productId);
      if (!product) throw new Error("Package not found");
      return product;
    }
    return listPackageProducts(workspaceId);
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "purchase") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      purchasePackageForContact(workspaceId, body.productId, body.contactId),
    );
  }
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertPackageProduct(workspaceId, body),
  );
}
