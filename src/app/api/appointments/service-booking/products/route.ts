import {
  listBookingProducts,
  upsertBookingProduct,
  duplicateBookingProduct,
} from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    listBookingProducts(workspaceId),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  if (body.action === "duplicate") {
    return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
      duplicateBookingProduct(workspaceId, body.productId),
    );
  }
  return withAppointmentsAuth("appointments.write", async ({ workspaceId }) =>
    upsertBookingProduct(workspaceId, body),
  );
}
