import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  appointmentsToCsv,
  buildAppointmentPdfReport,
  loadExtendedAppointmentsAnalytics,
} from "@/lib/appointments/analytics-reports";
import { getPrisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "csv";
    const rangeDays = Number(searchParams.get("range") || 30) as 7 | 30 | 90;

    const prisma = getPrisma();
    const from = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);
    const rows = await prisma.voiceAppointment.findMany({
      where: { workspaceId: auth.workspaceId, startsAt: { gte: from } },
      orderBy: { startsAt: "desc" },
    });

    if (format === "pdf") {
      const pdf = await buildAppointmentPdfReport(auth.workspaceId, rangeDays);
      return new NextResponse(pdf, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="appointments-report-${rangeDays}d.pdf"`,
        },
      });
    }

    const csv = appointmentsToCsv(
      rows.map((r) => ({
        id: r.id,
        serviceName: r.serviceName,
        startsAt: r.startsAt,
        status: r.status,
        inviteeName: ((r.metadata || {}) as { inviteeName?: string }).inviteeName,
      })),
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="appointments-${rangeDays}d.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      email?: string;
      cadence?: "daily" | "weekly";
      rangeDays?: number;
    };
    const { scheduleEmailedReport } = await import("@/lib/appointments/analytics-reports");
    const result = await scheduleEmailedReport(auth.workspaceId, {
      email: body.email || auth.session.email || "",
      cadence: body.cadence || "weekly",
      rangeDays: body.rangeDays || 30,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
