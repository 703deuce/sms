import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  buildDedicatedReminderTimeline,
  buildFutureReminderSchedule,
} from "@/lib/appointments/reminder-engine";
import { getAppointment, loadAppointmentPlatformConfig } from "@/lib/appointments";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentMetadata } from "@/lib/appointments/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const appt = await getAppointment(auth.workspaceId, id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await loadAppointmentPlatformConfig(auth.workspaceId);
    const weeklyHours = resolveWeeklyHours(config);
    const future = buildFutureReminderSchedule({
      startsAt: appt.startsAt,
      timezone: appt.timezone || config.timezone,
      steps: [
        { key: "confirmation", step: config.reminders.confirmation },
        { key: "reminder24h", step: config.reminders.reminder24h },
        { key: "reminder2h", step: config.reminders.reminder2h },
      ],
      metadata: appt.metadata as AppointmentMetadata,
      weeklyHours,
    });
    const timeline = buildDedicatedReminderTimeline(appt.metadata as AppointmentMetadata);

    return NextResponse.json({
      data: {
        future,
        timeline,
        suppressed: Boolean((appt.metadata as AppointmentMetadata).remindersSuppressed),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
