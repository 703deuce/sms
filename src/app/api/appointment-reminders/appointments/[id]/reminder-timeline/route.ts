import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import {
  buildDedicatedReminderTimeline,
  buildFutureReminderSchedule,
} from "@/lib/appointments/reminder-engine";
import { getAppointment, loadAppointmentPlatformConfig } from "@/lib/appointments";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { loadArReminderEngagementPayload } from "@/lib/appointment-reminders/ar-reminder-engagement.server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const appt = await getAppointment(auth.workspaceId, id);
    if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const config = await loadAppointmentPlatformConfig(auth.workspaceId);
    const weeklyHours = resolveWeeklyHours(config);
    const meta = appt.metadata as AppointmentMetadata;
    const future = buildFutureReminderSchedule({
      startsAt: appt.startsAt,
      timezone: appt.timezone || config.timezone,
      steps: [
        { key: "confirmation", step: config.reminders.confirmation },
        { key: "reminder24h", step: config.reminders.reminder24h },
        { key: "reminder2h", step: config.reminders.reminder2h },
      ],
      metadata: meta,
      weeklyHours,
    });
    const timeline = buildDedicatedReminderTimeline(meta);
    const engagement = await loadArReminderEngagementPayload({
      workspaceId: auth.workspaceId,
      appointmentId: id,
      metadata: meta,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
      timezone: appt.timezone,
      status: appt.status,
    });

    return NextResponse.json({
      data: {
        future,
        timeline,
        suppressed: Boolean(meta.remindersSuppressed),
        customerResponse: engagement.customerResponse,
        customerActionHistory: engagement.customerActionHistory,
        reminderEngagement: engagement.reminderEngagement,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
