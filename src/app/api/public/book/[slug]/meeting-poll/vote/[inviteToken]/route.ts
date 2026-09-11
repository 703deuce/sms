import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadPublicPollByParticipantToken, submitParticipantResponses } from "@/lib/appointments/meeting-polls/public";
import type { MeetingPollVoteValue } from "@/lib/appointments/scheduling-capabilities";

type Params = { params: Promise<{ slug: string; inviteToken: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug, inviteToken } = await params;
    const data = await loadPublicPollByParticipantToken(slug, inviteToken);
    if (!data) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
    const { poll, participant, ...rest } = data;
    const participantResponses = poll.responses.filter((r) => r.participantId === participant.id);
    return NextResponse.json({
      data: {
        ...rest,
        poll: {
          id: poll.id,
          title: poll.title,
          description: poll.description,
          durationMinutes: poll.durationMinutes,
          timezone: poll.timezone,
          deadlineAt: poll.deadlineAt,
          status: poll.status,
          derivedStatus: rest.derivedStatus,
          options: poll.options.filter((o) => !o.archivedAt),
          settings: {
            allowMaybe: poll.settings.allowMaybe,
            allowComments: poll.settings.allowComments,
          },
        },
        participant: { id: participant.id, name: participant.name },
        responses: participantResponses,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { slug, inviteToken } = await params;
    const body = (await request.json()) as {
      responses?: Array<{ optionId: string; value: MeetingPollVoteValue }>;
      comment?: string;
    };
    const data = await loadPublicPollByParticipantToken(slug, inviteToken);
    if (!data) return NextResponse.json({ error: "Invalid link" }, { status: 403 });
    if (!body.responses?.length) {
      return NextResponse.json({ error: "responses required" }, { status: 400 });
    }
    await submitParticipantResponses({
      workspaceId: data.workspace.id,
      pollId: data.poll.id,
      participantId: data.participant.id,
      responses: body.responses,
      comment: body.comment,
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
