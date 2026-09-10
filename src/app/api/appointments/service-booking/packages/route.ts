import {
  listPackageProducts,
  upsertPackageProduct,
  purchasePackageForContact,
  listPackageBalancesForProduct,
  duplicatePackageProduct,
} from "@/lib/appointments/service-booking/packages";
import {
  adjustPackageCredits,
  getPackageLedgerHistory,
} from "@/lib/appointments/service-booking/package-lifecycle";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const balanceId = searchParams.get("balanceId");
  const ledger = searchParams.get("ledger");

  if (balanceId && ledger === "1") {
    return withAppointmentsAuth("appointments.read", async () =>
      getPackageLedgerHistory(balanceId),
    );
  }

  if (productId) {
    return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
      listPackageBalancesForProduct(workspaceId, productId),
    );
  }

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

  if (body.action === "adjust") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      adjustPackageCredits(workspaceId, body.balanceId, body.delta, body.note || "Manual adjustment"),
    );
  }

  if (body.action === "duplicate") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      duplicatePackageProduct(workspaceId, body.productId),
    );
  }

  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertPackageProduct(workspaceId, body),
  );
}
