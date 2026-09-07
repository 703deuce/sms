import { NextResponse } from "next/server";
import { getActiveWorkspaceId, getSession } from "@/lib/auth";
import {
  resumeMctbAutomation,
  takeOverMctbConversation,
  updateMctbFollowUpStatus,
} from "@/lib/mctb/handoff/process-inbound-reply";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getActiveWorkspaceId();
  const body = (await req.json()) as {
    action: "take_over" | "resume_automation" | "follow_up";
    conversationId: string;
    followUpStatus?: "needs_follow_up" | "acknowledged" | "called_back" | "resolved" | "appointment_booked";
  };

  if (!body.conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  try {
    if (body.action === "take_over") {
      const row = await takeOverMctbConversation({
        workspaceId,
        conversationId: body.conversationId,
        userId: session.userId,
      });
      return NextResponse.json({ data: row });
    }
    if (body.action === "resume_automation") {
      const row = await resumeMctbAutomation({
        workspaceId,
        conversationId: body.conversationId,
      });
      return NextResponse.json({ data: row });
    }
    if (body.action === "follow_up" && body.followUpStatus) {
      const row = await updateMctbFollowUpStatus({
        workspaceId,
        conversationId: body.conversationId,
        status: body.followUpStatus,
        userId: session.userId,
      });
      return NextResponse.json({ data: row });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 400 },
    );
  }
}
