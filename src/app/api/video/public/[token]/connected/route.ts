import { NextResponse } from "next/server";
import { findVideoMeetingByToken, markParticipantConnected } from "@/lib/transovo-video/service";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const meeting = await findVideoMeetingByToken(token);
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const participantId = String(body.participantId || "");
  if (!participantId) {
    return NextResponse.json({ error: "participantId required" }, { status: 400 });
  }

  await markParticipantConnected(
    participantId,
    body.providerParticipantId ? String(body.providerParticipantId) : undefined,
  );
  return NextResponse.json({ ok: true });
}
