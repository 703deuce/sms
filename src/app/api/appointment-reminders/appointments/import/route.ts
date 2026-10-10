import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { importArAppointmentsFromCsv, parseArAppointmentCsv } from "@/lib/appointment-reminders/ar-manual-appointments";
import { loadAppointmentPlatformConfig } from "@/lib/appointments";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.write");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { csv?: string; preview?: boolean };
    const csv = body.csv?.trim();
    if (!csv) {
      return NextResponse.json({ error: "csv is required" }, { status: 400 });
    }

    const platform = await loadAppointmentPlatformConfig(auth.workspaceId);
    if (body.preview) {
      const rows = parseArAppointmentCsv(csv, platform.timezone);
      return NextResponse.json({
        data: {
          rows: rows.map((r) => ({
            rowNumber: r.rowNumber,
            inviteeName: r.inviteeName,
            startsAt: r.startsAt.toISOString(),
            inviteeEmail: r.inviteeEmail,
            inviteePhone: r.inviteePhone,
            serviceName: r.serviceName,
            errors: r.errors,
          })),
          valid: rows.filter((r) => r.errors.length === 0).length,
          invalid: rows.filter((r) => r.errors.length > 0).length,
        },
      });
    }

    const result = await importArAppointmentsFromCsv(auth.workspaceId, csv, platform.timezone);
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
