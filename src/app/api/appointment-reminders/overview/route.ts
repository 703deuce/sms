import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadAppointmentRemindersOverview } from "@/lib/appointment-reminders/load-ar-overview";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { scheduleAppointmentRemindersCalendarSync } = await import(
      "@/lib/appointment-reminders/calendar/ensure-calendars-synced"
    );
    scheduleAppointmentRemindersCalendarSync(auth.workspaceId);
    const data = await loadAppointmentRemindersOverview(auth.workspaceId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
