import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { loadArConversationInbox } from "@/lib/appointment-reminders/load-ar-conversation-inbox";
import { workspaceAllowsSmsCustomerResponses } from "@/lib/appointment-reminders/commercial/ar-feature-gates";

export async function GET(req: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.read");
    if ("error" in auth) return auth.error;

    const responsesAllowed = await workspaceAllowsSmsCustomerResponses(auth.workspaceId);
    if (!responsesAllowed) {
      return NextResponse.json({
        data: {
          gated: true,
          conversations: [],
          message: "SMS reply visibility requires Starter or higher.",
        },
      });
    }

    const url = new URL(req.url);
    const limit = Math.min(20, Math.max(1, Number(url.searchParams.get("limit") || "8")));
    const conversations = await loadArConversationInbox(auth.workspaceId, limit);

    return NextResponse.json({ data: { gated: false, conversations } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
