import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { listHeldInboundForWorkspace } from "@/lib/appointment-reminders/messaging/platform-inbound-held";

export async function GET() {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const rows = await listHeldInboundForWorkspace(auth.workspaceId);
    const data = rows.map((row) => {
      const candidates = (row.candidateContexts as Array<{
        product: string;
        workspaceId: string;
        replySessionId?: string;
        appointmentId?: string;
      }>).filter((c) => c.workspaceId === auth.workspaceId);
      return {
        id: row.id,
        fromE164: row.fromE164,
        toE164: row.toE164,
        bodyPreview: row.bodyPreview,
        holdReason: row.holdReason,
        channel: row.channel,
        createdAt: row.createdAt.toISOString(),
        candidates,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 500);
  }
}
