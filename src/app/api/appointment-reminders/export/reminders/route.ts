import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadAppointmentRemindersOperationalPage } from "@/lib/appointment-reminders/load-reminders-operational-page";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days") || "30")));
    const pageSize = 500;
    let page = 1;
    const rows: Awaited<ReturnType<typeof loadAppointmentRemindersOperationalPage>>["rows"] = [];
    for (;;) {
      const batch = await loadAppointmentRemindersOperationalPage(auth.workspaceId, {
        page,
        pageSize,
        horizon: "all",
      });
      rows.push(...batch.rows);
      if (batch.rows.length < pageSize) break;
      page += 1;
      if (page > 20) break;
    }

    const header = [
      "occurred_at",
      "scheduled_for",
      "customer",
      "appointment_id",
      "channel",
      "reminder",
      "status",
      "detail",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.occurredAt || "",
          r.scheduledFor || "",
          r.customerLabel,
          r.appointmentId,
          r.channel,
          r.reminderLabel,
          r.statusLabel,
          r.detail || "",
        ]
          .map((c) => csvEscape(String(c)))
          .join(","),
      ),
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointment-reminders-log-${days}d.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
