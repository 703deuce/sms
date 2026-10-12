import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { getPrisma } from "@/lib/db";
import type { AppointmentMetadata } from "@/lib/appointments/types";
import type { ArCalendarWriteBackRecord } from "@/lib/appointment-reminders/calendar-write-back/types";
import { triggerArCalendarWriteBack } from "@/lib/appointment-reminders/calendar-write-back/trigger";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.write");
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const row = await getPrisma().voiceAppointment.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const meta = (row.metadata || {}) as AppointmentMetadata & {
      arCalendarWriteBack?: ArCalendarWriteBackRecord;
    };
    const wb = meta.arCalendarWriteBack;
    const kind = wb?.lastKind;
    if (!kind) {
      return NextResponse.json({ error: "No write-back to retry" }, { status: 400 });
    }

    await triggerArCalendarWriteBack({
      workspaceId: auth.workspaceId,
      appointmentId: id,
      kind,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
