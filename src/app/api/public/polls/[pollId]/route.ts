import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { voteMeetingPollOption } from "@/lib/appointments/meeting-polls";
import type { MeetingPoll } from "@/lib/appointments/scheduling-capabilities";

type Params = { params: Promise<{ pollId: string }> };

async function findPoll(pollId: string): Promise<{ workspaceId: string; poll: MeetingPoll } | null> {
  const { getPrisma } = await import("@/lib/db");
  const workspaces = await getPrisma().workspace.findMany({
    select: { id: true },
    take: 500,
  });
  for (const ws of workspaces) {
    const platform = await loadAppointmentPlatformConfig(ws.id);
    const polls = (platform as { meetingPolls?: MeetingPoll[] }).meetingPolls || [];
    const poll = polls.find((p) => p.id === pollId);
    if (poll) return { workspaceId: ws.id, poll };
  }
  return null;
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { pollId } = await params;
    const found = await findPoll(pollId);
    if (!found) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    const { poll } = found;
    return NextResponse.json({
      data: {
        id: poll.id,
        title: poll.title,
        status: poll.status,
        bookedAppointmentId: poll.bookedAppointmentId,
        options: poll.options.map((o) => ({
          id: o.id,
          startsAt: o.startsAt,
          endsAt: o.endsAt,
          votes: o.votes,
        })),
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { pollId } = await params;
    const found = await findPoll(pollId);
    if (!found) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    const { workspaceId, poll } = found;
    if (poll.status === "booked" && poll.bookedAppointmentId) {
      return NextResponse.json({
        data: { scheduled: true, poll },
        message: "This meeting has already been scheduled.",
      });
    }
    if (poll.status !== "open") {
      return NextResponse.json({ error: "This poll is no longer accepting responses." }, { status: 400 });
    }
    const body = (await request.json()) as { optionId?: string };
    const optionId = String(body.optionId || "").trim();
    if (!optionId) {
      return NextResponse.json({ error: "Please select a time option." }, { status: 400 });
    }
    const updated = await voteMeetingPollOption(workspaceId, pollId, optionId);
    if (!updated) {
      return NextResponse.json({ error: "Could not record your response." }, { status: 400 });
    }
    return NextResponse.json({ data: updated });
  } catch (err) {
    return jsonError(err, 400);
  }
}
