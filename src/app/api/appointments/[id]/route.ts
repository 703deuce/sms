import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  buildReminderSchedule,
  cancelPlatformAppointment,
  getAppointment,
  loadAppointmentPlatformConfig,
  updatePlatformAppointmentStatus,
} from "@/lib/appointments";
import { addInternalNote } from "@/lib/appointments/internal-notes";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const data = await getAppointment(auth.workspaceId, id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const config = await loadAppointmentPlatformConfig(auth.workspaceId);
    const reminderSchedule = buildReminderSchedule({
      startsAt: data.startsAt,
      metadata: data.metadata,
      config: config.reminders,
    });
    return NextResponse.json({ data: { ...data, reminderSchedule } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      action?: string;
      internalNote?: string;
    };

    if (body.internalNote?.trim()) {
      const note = await addInternalNote(auth.workspaceId, id, {
        body: body.internalNote,
        authorId: auth.session.userId,
        authorName: auth.session.email || "Staff",
      });
      const data = await getAppointment(auth.workspaceId, id);
      return NextResponse.json({ data, note });
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
