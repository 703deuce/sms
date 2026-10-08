import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { resolveHeldInboundMessage } from "@/lib/appointment-reminders/messaging/platform-inbound-held";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.write");
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const body = (await request.json()) as {
      resolution?: "dismiss" | "route_ar";
      replySessionId?: string;
      conversationId?: string;
      note?: string;
    };

    if (body.resolution !== "dismiss" && body.resolution !== "route_ar") {
      return NextResponse.json({ error: "resolution must be dismiss or route_ar" }, { status: 400 });
    }

    const result = await resolveHeldInboundMessage({
      heldMessageId: id,
      workspaceId: auth.workspaceId,
      staffUserId: auth.session.userId,
      resolution: body.resolution,
      replySessionId: body.replySessionId,
      conversationId: body.conversationId,
      note: body.note,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 500);
  }
}
