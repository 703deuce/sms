import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  loadAcuityStyleReports,
  reportsToCsv,
} from "@/lib/appointments/service-booking/reporting";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.analytics.read");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const rangeDays = Number(searchParams.get("range") || 30);
    const to = new Date();
    const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const format = searchParams.get("format");
    const status = searchParams.get("status") || undefined;
    const staffId = searchParams.get("staffId") || undefined;
    const bookingTypeId = searchParams.get("bookingTypeId") || undefined;

    const report = await loadAcuityStyleReports(auth.workspaceId, from, to, {
      status,
      staffId,
      bookingTypeId,
    });

    if (format === "csv") {
      const csv = reportsToCsv(report);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="appointments-report-${rangeDays}d.csv"`,
        },
      });
    }

    return NextResponse.json({
      data: {
        from: from.toISOString(),
        to: to.toISOString(),
        rangeDays,
        report,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
