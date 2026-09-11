import {
  adjustPackageCredits,
  countPackageOwners,
  deletePackageProduct,
  duplicatePackageProduct,
  getPackageCatalogStats,
  getPackageProduct,
  listPackageActivityForProduct,
  listPackageBalancesForProduct,
  listPackageProducts,
  purchasePackageForContact,
  upsertPackageProduct,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");
  const view = url.searchParams.get("view");

  if (productId && view === "balances") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      listPackageBalancesForProduct(workspaceId, productId),
    );
  }

  if (productId && view === "activity") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      listPackageActivityForProduct(workspaceId, productId),
    );
  }

  if (productId) {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
      const row = await getPackageProduct(workspaceId, productId);
      if (!row) throw new Error("Package not found");
      return row;
    });
  }

  if (view === "stats") {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      getPackageCatalogStats(workspaceId),
    );
  }

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const rows = await listPackageProducts(workspaceId);
    const ownerCounts = await countPackageOwners(workspaceId, rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      ownerCount: ownerCounts.get(row.id) ?? 0,
    }));
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.action === "purchase") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      purchasePackageForContact(workspaceId, body.productId, body.contactId),
    );
  }

  if (body.action === "duplicate") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      duplicatePackageProduct(workspaceId, body.productId),
    );
  }

  if (body.action === "delete") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      deletePackageProduct(workspaceId, body.productId),
    );
  }

  if (body.action === "adjust_credits") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      adjustPackageCredits(workspaceId, body.balanceId, body.delta, String(body.note || "Manual adjustment")),
    );
  }

  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertPackageProduct(workspaceId, body),
  );
}
