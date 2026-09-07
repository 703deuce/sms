import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  buildReminderSchedule,
  cancelPlatformAppointment,
  getAppointment,
  loadAppointmentPlatformConfig,
  reschedulePlatformAppointment,
  updatePlatformAppointmentStatus,
} from "@/lib/appointments";
import { resolveWeeklyHours } from "@/lib/appointments/availability-engine-policy";
import { addInternalNote } from "@/lib/appointments/internal-notes";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { suppressAppointmentReminders, resetAppointmentReminders } from "@/lib/appointments/reminder-state";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getAppointment(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(auth.workspaceId);
    const reminderSchedule = buildReminderSchedule({
      startsAt: data.startsAt,
      metadata: data.metadata,
      config: config.reminders,
      timezone: data.timezone || config.timezone,
      weeklyHours: resolveWeeklyHours(config),
    });
    return NextResponse.json({ data: { ...data, reminderSchedule } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentsAccess("appointments.write");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      action?: string;
      internalNote?: string;
      startsAt?: string;
      suppressReminders?: boolean;
      extraRecipients?: Array<{ email?: string; phone?: string; name?: string }>;
    };

    if (body.suppressReminders !== undefined || body.extraRecipients !== undefined) {
      const prisma = getPrisma();
      const row = await prisma.voiceAppointment.findFirst({
        where: { id, workspaceId: auth.workspaceId },
      });
      if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
      let meta = (row.metadata || {}) as AppointmentMetadata;
      if (body.suppressReminders !== undefined) {
        meta = body.suppressReminders
          ? suppressAppointmentReminders(meta)
          : resetAppointmentReminders(meta);
        meta = {
          ...meta,
          reminderOverride: {
            ...(meta.reminderOverride || {}),
            suppressed: body.suppressReminders,
          },
        };
      }
      if (body.extraRecipients !== undefined) {
        meta = { ...meta, extraRecipients: body.extraRecipients };
      }
      await prisma.voiceAppointment.update({
        where: { id: row.id },
        data: { metadata: meta as object, updatedAt: new Date() },
      });
      const data = await getAppointment(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (body.internalNote?.trim()) {
      const note = await addInternalNote(auth.workspaceId, id, {
        body: body.internalNote,
        authorId: auth.session.userId,
        authorName: auth.session.email || "Staff",
      });
      const data = await getAppointment(auth.workspaceId, id);
      return NextResponse.json({ data, note });
    }

    if (body.startsAt?.trim()) {
      const updated = await reschedulePlatformAppointment(
        auth.workspaceId,
        id,
        body.startsAt.trim(),
        "staff",
      );
      const data = await getAppointment(auth.workspaceId, id);
      const config = await loadAppointmentPlatformConfig(auth.workspaceId);
      const reminderSchedule = buildReminderSchedule({
        startsAt: data?.startsAt || updated.startsAt.toISOString(),
        metadata: (data?.metadata || updated.metadata || {}) as AppointmentMetadata,
        config: config.reminders,
      });
      return NextResponse.json({
        data: data ? { ...data, reminderSchedule } : { id: updated.id, reminderSchedule },
      });
    }

    if (body.action === "cancel" || body.status === "canceled") {
      const data = await cancelPlatformAppointment(auth.workspaceId, id);
      return NextResponse.json({ data });
    }
    if (body.status) {
      const data = await updatePlatformAppointmentStatus(auth.workspaceId, id, body.status, {
        type: "status_updated",
        label: `Status updated to ${body.status}`,
      });
      return NextResponse.json({ data });
    }
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
