import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadAppointmentRemindersOperationalPage } from "@/lib/appointment-reminders/load-reminders-operational-page";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const data = await loadAppointmentRemindersOperationalPage(auth.workspaceId, {
      q: searchParams.get("q") || undefined,
      status: searchParams.get("status") || "all",
      horizon: searchParams.get("horizon") || "all",
      page: searchParams.get("page") ? Number(searchParams.get("page")) : 1,
      pageSize: searchParams.get("pageSize") ? Number(searchParams.get("pageSize")) : 25,
    });
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
