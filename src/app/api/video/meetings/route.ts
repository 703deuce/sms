import { NextResponse } from "next/server";
import type { DbRow } from "@/lib/db";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";
import { listVideoMeetings, provisionStandaloneVideoMeeting } from "@/lib/transovo-video/service";
import { publicVideoMeetingUrl } from "@/lib/transovo-video/meeting-url";

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);

    const filter = new URL(request.url).searchParams.get("filter") as
      | "upcoming"
      | "past"
      | "all"
      | null;

    const meetings = await listVideoMeetings(auth.workspaceId, filter || "all");
    return NextResponse.json({
      data: {
        meetings: meetings.map((m: DbRow) => ({
          ...m,
          meetingUrl: publicVideoMeetingUrl(m.publicMeetingToken),
          hostJoinUrl: `/video/rooms/${m.id}/host`,
        })),
      },
    });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);

    const body = await request.json();
    const action = String(body.action || "instant");

    if (action === "instant") {
      const result = await provisionStandaloneVideoMeeting({
        workspaceId: auth.workspaceId,
        hostUserId: auth.session.userId,
        title: body.title ? String(body.title) : "Instant meeting",
        recordingMode: body.recordingMode ? String(body.recordingMode) : undefined,
        transcriptionEnabled: body.transcriptionEnabled === true,
        aiRecapEnabled: body.aiRecapEnabled === true,
        waitingRoomEnabled: body.waitingRoomEnabled === true,
      });
      return NextResponse.json({
        data: {
          ...result,
          hostJoinUrl: `/video/rooms/${result.videoMeetingId}/host`,
        },
      });
    }

    if (action === "schedule") {
      const startsAt = body.scheduledStartAt ? new Date(String(body.scheduledStartAt)) : null;
      if (!startsAt || Number.isNaN(startsAt.getTime())) {
        return NextResponse.json({ error: "scheduledStartAt is required" }, { status: 400 });
      }
      const durationMinutes = Number(body.durationMinutes || 30);
      const result = await provisionStandaloneVideoMeeting({
        workspaceId: auth.workspaceId,
        hostUserId: auth.session.userId,
        title: body.title ? String(body.title) : "Scheduled meeting",
        scheduledStartAt: startsAt,
        scheduledEndAt: new Date(startsAt.getTime() + durationMinutes * 60_000),
        recordingMode: body.recordingMode ? String(body.recordingMode) : undefined,
        transcriptionEnabled: body.transcriptionEnabled === true,
        aiRecapEnabled: body.aiRecapEnabled === true,
        waitingRoomEnabled: body.waitingRoomEnabled === true,
      });
      return NextResponse.json({
        data: {
          ...result,
          hostJoinUrl: `/video/rooms/${result.videoMeetingId}/host`,
        },
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}
