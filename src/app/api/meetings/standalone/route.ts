import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import { enableStandaloneNotetaker } from "@/lib/meeting-assistant/service";

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);

    const body = await request.json();
    const meetingUrl = String(body.meetingUrl || "").trim();
    if (!meetingUrl) {
      return NextResponse.json({ error: "meetingUrl is required" }, { status: 400 });
    }

    const scheduledStartAt = body.scheduledStartAt
      ? new Date(String(body.scheduledStartAt))
      : null;

    const session = await enableStandaloneNotetaker({
      workspaceId: auth.workspaceId,
      meetingUrl,
      title: body.title ? String(body.title) : undefined,
      botName: body.botName ? String(body.botName) : undefined,
      scheduledStartAt,
      recordingEnabled: body.recordingEnabled !== false,
      transcriptEnabled: body.transcriptEnabled !== false,
      summaryEnabled: body.summaryEnabled !== false,
      actionItemsEnabled: body.actionItemsEnabled !== false,
    });

    return NextResponse.json({ data: session });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}
