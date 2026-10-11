import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadRecentArCustomerResponses } from "@/lib/appointment-reminders/load-recent-customer-responses";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const url = new URL(request.url);
    const limit = Math.min(5000, Math.max(1, Number(url.searchParams.get("limit") || "500")));
    const rows = await loadRecentArCustomerResponses(auth.workspaceId, limit);

    const header = [
      "response_at",
      "appointment_id",
      "customer",
      "appointment_title",
      "starts_at",
      "timezone",
      "outcome_kind",
      "outcome_label",
    ];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.responseAt,
          r.appointmentId,
          r.customerName,
          r.appointmentTitle,
          r.startsAt,
          r.timezone || "",
          r.customerResponse.kind,
          r.customerResponse.label,
        ]
          .map((c) => csvEscape(String(c)))
          .join(","),
      ),
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="appointment-reminders-responses.csv"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
