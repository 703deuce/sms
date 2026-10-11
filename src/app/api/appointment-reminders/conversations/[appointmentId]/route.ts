import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadArConversationThread } from "@/lib/appointment-reminders/load-ar-conversation-inbox";
import { workspaceAllowsSmsCustomerResponses } from "@/lib/appointment-reminders/commercial/ar-feature-gates";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const responsesAllowed = await workspaceAllowsSmsCustomerResponses(auth.workspaceId);
    if (!responsesAllowed) {
      return NextResponse.json(
        { error: "SMS reply visibility requires Starter or higher." },
        { status: 403 },
      );
    }

    const { appointmentId } = await params;
    const url = new URL(req.url);
    const cursor = url.searchParams.get("cursor");
    const limit = Math.min(80, Math.max(10, Number(url.searchParams.get("limit") || "40")));

    const thread = await loadArConversationThread(
      auth.workspaceId,
      appointmentId,
      cursor || undefined,
      limit,
    );

    return NextResponse.json({ data: thread });
  } catch (err) {
    if (err instanceof Error && err.message === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return jsonError(err, 500);
  }
}
