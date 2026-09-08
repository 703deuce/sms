import { loadAcuityStyleReports, reportsToCsv } from "@/lib/appointments/service-booking";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = new Date(url.searchParams.get("from") || Date.now() - 30 * 86_400_000);
  const to = new Date(url.searchParams.get("to") || Date.now());
  const format = url.searchParams.get("format");

  const authResult = await withAppointmentsAuth("appointments.read", async ({ workspaceId }) =>
    loadAcuityStyleReports(workspaceId, from, to, {
      staffId: url.searchParams.get("staffId") || undefined,
      bookingTypeId: url.searchParams.get("bookingTypeId") || undefined,
      status: url.searchParams.get("status") || undefined,
    }),
  );

  if (format === "csv" && authResult instanceof NextResponse) {
    const json = await authResult.json();
    if (json.data) {
      return new NextResponse(reportsToCsv(json.data), {
        headers: { "Content-Type": "text/csv" },
      });
    }
  }
  return authResult;
}
