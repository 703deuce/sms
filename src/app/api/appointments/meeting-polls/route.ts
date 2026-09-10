import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createMeetingPoll,
  finalizeMeetingPollBooking,
  listMeetingPolls,
  meetingPollShareUrl,
  saveMeetingPoll,
  voteMeetingPollOption,
} from "@/lib/appointments/meeting-polls";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";

function serializeAdminPoll(poll: MeetingPoll, baseUrl: string) {
  const responded = poll.options.reduce((sum, o) => sum + o.votes, 0);
  return {
    ...poll,
    status: poll.status === "booked" ? "scheduled" : poll.status,
    shareUrl: meetingPollShareUrl(baseUrl, poll.id),
    location: "",
    durationMinutes: poll.options[0]
      ? Math.max(
          1,
          Math.round(
            (new Date(poll.options[0].endsAt).getTime() - new Date(poll.options[0].startsAt).getTime()) /
              60_000,
          ),
        )
      : 30,
    organizer: "",
    invitees: 0,
    responded,
    closesAt: null,
  };
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      new URL(request.url).origin;
    const polls = await listMeetingPolls(auth.workspaceId);
    return NextResponse.json({ data: polls.map((p) => serializeAdminPoll(p, baseUrl)) });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      pollId?: string;
      optionId?: string;
      title?: string;
      appointmentTypeId?: string;
      options?: Array<{ startsAt: string; endsAt: string }>;
      poll?: Parameters<typeof saveMeetingPoll>[1];
    };

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      new URL(request.url).origin;

    if (body.action === "vote" && body.pollId && body.optionId) {
      const poll = await voteMeetingPollOption(auth.workspaceId, body.pollId, body.optionId);
      return NextResponse.json({ data: poll ? serializeAdminPoll(poll, baseUrl) : poll });
    }

    if (body.action === "finalize" && body.pollId && body.optionId) {
      const result = await finalizeMeetingPollBooking(
        auth.workspaceId,
        body.pollId,
        body.optionId,
        {
          contactId: (body as { contactId?: string }).contactId,
          phone: (body as { phone?: string }).phone,
          email: (body as { email?: string }).email,
          firstName: (body as { firstName?: string }).firstName,
          lastName: (body as { lastName?: string }).lastName,
        },
      );
      return NextResponse.json({
        data: {
          ...result,
          poll: serializeAdminPoll(result.poll, baseUrl),
        },
      });
    }

    if (body.poll) {
      const saved = await saveMeetingPoll(auth.workspaceId, body.poll);
      return NextResponse.json({ data: serializeAdminPoll(saved, baseUrl) });
    }

    const poll = createMeetingPoll({
      workspaceId: auth.workspaceId,
      title: body.title || "Meeting poll",
      appointmentTypeId: body.appointmentTypeId,
      options: body.options || [],
    });
    const saved = await saveMeetingPoll(auth.workspaceId, poll);
    return NextResponse.json({ data: serializeAdminPoll(saved, baseUrl) }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const { deleteMeetingPoll } = await import("@/lib/appointments/meeting-polls");
    await deleteMeetingPoll(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
