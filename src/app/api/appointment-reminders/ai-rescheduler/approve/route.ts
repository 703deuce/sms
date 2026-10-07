import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { approveArRescheduleRequest } from "@/lib/appointment-reminders/ai-rescheduler/business-approval";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.write");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { appointmentId?: string };
    if (!body.appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }
    const result = await approveArRescheduleRequest({
      workspaceId: auth.workspaceId,
      appointmentId: body.appointmentId,
      staffUserId: auth.session.userId,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
