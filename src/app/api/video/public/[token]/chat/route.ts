import { NextResponse } from "next/server";
import { findVideoMeetingByToken, persistVideoChatMessage } from "@/lib/transovo-video/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const meeting = await findVideoMeetingByToken(token);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { getPrisma } = await import("@/lib/db");
  const prisma = getPrisma();
  const messages = await prisma.videoChatMessage.findMany({
    where: { videoMeetingId: meeting.id },
    orderBy: { sentAt: "asc" },
    take: 200,
  });
  return NextResponse.json({ data: { messages } });
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const meeting = await findVideoMeetingByToken(token);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!meeting.chatEnabled) {
    return NextResponse.json({ error: "Chat disabled" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const message = await persistVideoChatMessage({
    videoMeetingId: meeting.id,
    workspaceId: meeting.workspaceId,
    participantId: body.participantId ? String(body.participantId) : undefined,
    senderName: String(body.senderName || "Guest"),
    text,
  });
  return NextResponse.json({ data: { message } });
}
