import {
  getPackageLedgerHistory,
  getPackageProductDetail,
  upsertPackageProduct,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const balanceId = url.searchParams.get("balanceId");

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    if (balanceId) {
      return getPackageLedgerHistory(balanceId);
    }
    const detail = await getPackageProductDetail(workspaceId, id);
    if (!detail) throw new Error("Package not found");
    return detail;
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json();
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertPackageProduct(workspaceId, { ...body, id }),
  );
}
