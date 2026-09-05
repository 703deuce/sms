import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { findVideoMeetingByToken } from "@/lib/transovo-video/service";

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

export async function GET(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const meeting = await findVideoMeetingByToken(token);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hostParticipantId = new URL(request.url).searchParams.get("hostParticipantId") || "";
  if (!hostParticipantId) {
    return NextResponse.json({ error: "hostParticipantId required" }, { status: 400 });
  }

  try {
    await assertHostParticipant(meeting.id, hostParticipantId);
    const prisma = getPrisma();
    const participants = await prisma.videoParticipant.findMany({
      where: { videoMeetingId: meeting.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        state: true,
        isHost: true,
        requestedJoinAt: true,
        joinedAt: true,
      },
    });
    return NextResponse.json({ data: { participants } });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Forbidden" },
      { status: 403 },
    );
  }
}
