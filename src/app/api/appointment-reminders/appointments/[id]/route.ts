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
    const meta = data.metadata as AppointmentMetadata & {
      arCalendarWriteBack?: import("@/lib/appointment-reminders/calendar-write-back/types").ArCalendarWriteBackRecord;
    };
    const { calendarWriteBackUiStatus } = await import(
      "@/lib/appointment-reminders/calendar-write-back/ui-status"
    );
    const { resolveArCalendarWriteBackSettings } = await import(
      "@/lib/appointment-reminders/calendar-write-back/settings"
    );
    const { providerRefFromAppointment } = await import(
      "@/lib/appointment-reminders/ai-rescheduler/provider-mutations"
    );
    const wbSettings = resolveArCalendarWriteBackSettings(config);
    const ref = providerRefFromAppointment({
      externalId: data.externalId,
      metadata: data.metadata,
      timezone: data.timezone,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    });
    const calendarWriteBack = calendarWriteBackUiStatus(meta.arCalendarWriteBack, {
      settingEnabled: wbSettings.enabled,
      hasMicrosoftLink: ref?.provider === "microsoft",
    });

    return NextResponse.json({
      data: {
        ...data,
        reminderSchedule,
        calendarWriteBack,
        reminderRecipientPhones: meta.reminderRecipientPhones || [],
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.write");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { status?: string; attendanceOutcome?: string };
    const { getPrisma } = await import("@/lib/db");
    const prisma = getPrisma();
    const row = await prisma.voiceAppointment.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const status =
      body.attendanceOutcome === "no_show"
        ? "no_show"
        : body.attendanceOutcome === "attended"
          ? "completed"
          : body.status;

    if (!status) {
      return NextResponse.json({ error: "status or attendanceOutcome required" }, { status: 400 });
    }

    const meta = (row.metadata || {}) as Record<string, unknown>;
    if (body.attendanceOutcome) {
      meta.attendanceOutcome = body.attendanceOutcome;
      meta.attendanceRecordedAt = new Date().toISOString();
    }

    const updated = await prisma.voiceAppointment.update({
      where: { id },
      data: { status, metadata: meta as object },
    });
    return NextResponse.json({ data: { id: updated.id, status: updated.status } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
