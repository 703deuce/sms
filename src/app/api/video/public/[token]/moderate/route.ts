import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import {
  admitVideoParticipant,
  declineVideoParticipant,
  endVideoMeetingForEveryone,
  findVideoMeetingByToken,
  lockVideoMeeting,
  moderateVideoParticipant,
  unlockVideoMeeting,
} from "@/lib/transovo-video/service";

type RouteContext = { params: Promise<{ token: string }> };

async function assertHostParticipant(videoMeetingId: string, participantId: string) {
  const prisma = getPrisma();
  const participant = await prisma.videoParticipant.findFirst({
    where: { id: participantId, videoMeetingId },
  });
  if (!participant || !participant.isHost) {
    throw new Error("Host authorization required");
  }
  return participant;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const meeting = await findVideoMeetingByToken(token);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const hostParticipantId = String(body.hostParticipantId || "");
  const action = String(body.action || "");
  if (!hostParticipantId) {
    return NextResponse.json({ error: "hostParticipantId required" }, { status: 400 });
  }

  try {
    await assertHostParticipant(meeting.id, hostParticipantId);

    switch (action) {
      case "admit":
        await admitVideoParticipant({
          workspaceId: meeting.workspaceId,
          videoMeetingId: meeting.id,
          participantId: String(body.participantId),
          hostUserId: meeting.hostUserId || hostParticipantId,
        });
        break;
      case "decline":
        await declineVideoParticipant({
          workspaceId: meeting.workspaceId,
          videoMeetingId: meeting.id,
          participantId: String(body.participantId),
          hostUserId: meeting.hostUserId || hostParticipantId,
        });
        break;
      case "mute":
      case "unmute":
      case "remove":
        await moderateVideoParticipant({
          workspaceId: meeting.workspaceId,
          videoMeetingId: meeting.id,
          participantId: String(body.participantId),
          action: action as "mute" | "unmute" | "remove",
          hostUserId: meeting.hostUserId || hostParticipantId,
        });
        break;
      case "lock":
        await lockVideoMeeting(meeting.workspaceId, meeting.id);
        break;
      case "unlock":
        await unlockVideoMeeting(meeting.workspaceId, meeting.id);
        break;
      case "end":
        await endVideoMeetingForEveryone({
          workspaceId: meeting.workspaceId,
          videoMeetingId: meeting.id,
          hostUserId: meeting.hostUserId || hostParticipantId,
        });
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Action failed" },
      { status: 403 },
    );
  }
}
