import { globalServiceBookingSearch } from "@/lib/appointments/service-booking/phase2";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const limit = url.searchParams.get("limit");
  const kinds = url.searchParams.get("kinds")?.split(",").filter(Boolean) as
    | Array<"appointment" | "contact" | "booking_category" | "package" | "class_series">
    | undefined;

  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    globalServiceBookingSearch(workspaceId, q, {
      limit: limit ? Number(limit) : undefined,
      kinds,
    }),
  );
}
