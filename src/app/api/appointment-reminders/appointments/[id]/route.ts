import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  buildReminderSchedule,
  getAppointment,
  loadAppointmentPlatformConfig,
} from "@/lib/appointments";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentMetadata } from "@/lib/appointments/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getAppointment(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(auth.workspaceId);
    const reminderSchedule = buildReminderSchedule({
      startsAt: data.startsAt,
      metadata: data.metadata as AppointmentMetadata,
      config: config.reminders,
      timezone: data.timezone || config.timezone,
      weeklyHours: resolveWeeklyHours(config),
    });
    return NextResponse.json({ data: { ...data, reminderSchedule } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
