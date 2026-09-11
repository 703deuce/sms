import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadPublicPollBySlugAndToken, submitParticipantResponses } from "@/lib/appointments/meeting-polls/public";
import type { MeetingPollVoteValue } from "@/lib/appointments/scheduling-capabilities";

type Params = { params: Promise<{ slug: string; token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug, token } = await params;
    const data = await loadPublicPollBySlugAndToken(slug, token);
    if (!data) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    const { poll, ...rest } = data;
    const safePoll = {
      ...poll,
      participants: poll.settings.showNamesToParticipants
        ? poll.participants.map((p) => ({ id: p.id, name: p.name, status: p.status }))
        : [],
      responses: poll.settings.showAggregateBeforeResponse ? poll.responses : [],
    };
    return NextResponse.json({ data: { ...rest, poll: safePoll } });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug, token } = await params;
    const body = (await request.json()) as {
      participantToken?: string;
      participantId?: string;
      responses?: Array<{ optionId: string; value: MeetingPollVoteValue }>;
      comment?: string;
    };
    const loaded = await loadPublicPollBySlugAndToken(slug, token);
    if (!loaded) return NextResponse.json({ error: "Poll not found" }, { status: 404 });

    let participantId = body.participantId;
    if (body.participantToken) {
      const part = loaded.poll.participants.find((p) => p.inviteToken === body.participantToken);
      if (!part) return NextResponse.json({ error: "Invalid participant link" }, { status: 403 });
      participantId = part.id;
    }
    if (!participantId || !body.responses?.length) {
      return NextResponse.json({ error: "participantId and responses required" }, { status: 400 });
    }

    const saved = await submitParticipantResponses({
      workspaceId: loaded.workspace.id,
      pollId: loaded.poll.id,
      participantId,
      responses: body.responses,
      comment: body.comment,
    });
    return NextResponse.json({ data: { ok: true, pollId: saved.id } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
