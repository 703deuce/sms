import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { resolveWorkspaceBySlug } from "@/lib/appointments";
import { getPrisma } from "@/lib/db";
import { buildFutureReminderSchedule } from "@/lib/appointments/reminder-engine";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import type { AppointmentMetadata } from "@/lib/appointments/types";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const workspace = await resolveWorkspaceBySlug(slug);
    if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get("phone");
    const email = searchParams.get("email");
    const appointmentId = searchParams.get("appointmentId");

    const prisma = getPrisma();
    let appt = appointmentId
      ? await prisma.voiceAppointment.findFirst({
          where: { id: appointmentId, workspaceId: workspace.id },
        })
      : null;

    if (!appt && (phone || email)) {
      appt = await prisma.voiceAppointment.findFirst({
        where: {
          workspaceId: workspace.id,
          startsAt: { gte: new Date() },
          status: { notIn: ["canceled", "cancelled", "completed", "no_show"] },
          OR: [
            ...(phone ? [{ inviteePhone: phone }] : []),
            ...(email ? [{ inviteeEmail: email }] : []),
          ],
        },
        orderBy: { startsAt: "asc" },
      });
    }

    if (!appt) {
      return NextResponse.json({ data: { found: false, message: "No upcoming appointment found." } });
    }

    const config = await loadAppointmentPlatformConfig(workspace.id);
    const meta = (appt.metadata || {}) as AppointmentMetadata;
    const schedule = buildFutureReminderSchedule({
      startsAt: appt.startsAt.toISOString(),
      timezone: appt.timezone || config.timezone,
      steps: [
        { key: "confirmation", step: config.reminders.confirmation },
        { key: "reminder24h", step: config.reminders.reminder24h },
        { key: "reminder2h", step: config.reminders.reminder2h },
      ],
      metadata: meta,
      weeklyHours: resolveWeeklyHours(config),
    });

    const timeline = (meta.timeline || []).filter((t) =>
      t.type.includes("reminder") || t.type.includes("confirmation"),
    );

    return NextResponse.json({
      data: {
        found: true,
        appointment: {
          id: appt.id,
          serviceName: appt.serviceName,
          startsAt: appt.startsAt.toISOString(),
          status: appt.status,
          remindersSuppressed: Boolean(meta.remindersSuppressed || meta.reminderOverride?.suppressed),
        },
        upcomingReminders: schedule.filter((s) => s.status === "scheduled"),
        reminderHistory: timeline,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
