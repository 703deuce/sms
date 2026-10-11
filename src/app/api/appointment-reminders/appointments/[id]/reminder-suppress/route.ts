import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { getAppointment } from "@/lib/appointments";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import { suppressAppointmentReminders } from "@/lib/appointments/reminder-state";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.write");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as { suppressed?: boolean };
    if (body.suppressed === undefined) {
      return NextResponse.json({ error: "suppressed is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const row = await prisma.voiceAppointment.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = (row.metadata || {}) as AppointmentMetadata;
    const nextMeta = body.suppressed
      ? suppressAppointmentReminders({
          ...meta,
          reminderOverride: { ...(meta.reminderOverride || {}), suppressed: true },
        })
      : {
          ...meta,
          remindersSuppressed: false,
          reminderStatus: meta.reminderStatus === "canceled" ? "scheduled" : meta.reminderStatus,
          reminderOverride: { ...(meta.reminderOverride || {}), suppressed: false },
        };

    await prisma.voiceAppointment.update({
      where: { id: row.id },
      data: { metadata: nextMeta as object, updatedAt: new Date() },
    });

    const data = await getAppointment(auth.workspaceId, id);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
