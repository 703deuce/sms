import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createMeetingPoll,
  listMeetingPolls,
  saveMeetingPoll,
  voteMeetingPollOption,
} from "@/lib/appointments/meeting-polls";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    return NextResponse.json({ data: await listMeetingPolls(auth.workspaceId) });
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

    if (body.action === "vote" && body.pollId && body.optionId) {
      const poll = await voteMeetingPollOption(auth.workspaceId, body.pollId, body.optionId);
      return NextResponse.json({ data: poll });
    }

    if (body.poll) {
      const saved = await saveMeetingPoll(auth.workspaceId, body.poll);
      return NextResponse.json({ data: saved });
    }

    const poll = createMeetingPoll({
      workspaceId: auth.workspaceId,
      title: body.title || "Meeting poll",
      appointmentTypeId: body.appointmentTypeId,
      options: body.options || [],
    });
    const saved = await saveMeetingPoll(auth.workspaceId, poll);
    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
