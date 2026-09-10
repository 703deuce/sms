import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentsAccess } from "@/lib/api-appointments-auth";
import {
  createMeetingPoll,
  listMeetingPolls,
  saveMeetingPoll,
  voteMeetingPollOption,
  deleteMeetingPoll,
  getMeetingPoll,
  finalizeMeetingPollBooking,
  closeMeetingPoll,
  assertPollCreateAccess,
} from "@/lib/appointments/meeting-polls";
import {
  filterMeetingPollsForUser,
  filterMeetingTypesForPollCreation,
  assertPollManageAccess,
} from "@/lib/appointments/meeting-poll-access";

export async function GET(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.read");
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    if (searchParams.get("eligibleMeetingTypes") === "1") {
      const types = await filterMeetingTypesForPollCreation(
        auth.workspaceId,
        auth.session.userId,
        auth.session.email,
      );
      return NextResponse.json({
        data: types.map((t) => ({
          id: t.id,
          name: t.name,
          durationMinutes: t.durationMinutes,
        })),
      });
    }

    const polls = await listMeetingPolls(auth.workspaceId);
    const filtered = await filterMeetingPollsForUser(
      auth.workspaceId,
      auth.session.userId,
      auth.session.email,
      polls,
    );
    return NextResponse.json({ data: filtered });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.book");
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
      if (!poll) return NextResponse.json({ error: "Poll not open" }, { status: 400 });
      return NextResponse.json({ data: poll });
    }

    if (body.action === "finalize" && body.pollId && body.optionId) {
      const result = await finalizeMeetingPollBooking(
        auth.workspaceId,
        auth.session.userId,
        auth.session.email,
        body.pollId,
        body.optionId,
      );
      return NextResponse.json({ data: result });
    }

    if (body.action === "close" && body.pollId) {
      const poll = await closeMeetingPoll(
        auth.workspaceId,
        auth.session.userId,
        auth.session.email,
        body.pollId,
      );
      return NextResponse.json({ data: poll });
    }

    if (body.poll) {
      const existing = await getMeetingPoll(auth.workspaceId, body.poll.id);
      if (existing) {
        await assertPollManageAccess(
          auth.workspaceId,
          auth.session.userId,
          auth.session.email,
          existing,
        );
      }
      const saved = await saveMeetingPoll(auth.workspaceId, body.poll);
      return NextResponse.json({ data: saved });
    }

    await assertPollCreateAccess(
      auth.workspaceId,
      auth.session.userId,
      auth.session.email,
      body.appointmentTypeId,
    );

    const poll = createMeetingPoll({
      workspaceId: auth.workspaceId,
      title: body.title || "Meeting poll",
      appointmentTypeId: body.appointmentTypeId,
      options: body.options || [],
    });
    const saved = await saveMeetingPoll(auth.workspaceId, poll);
    return NextResponse.json({ data: saved }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("permission") || message.includes("Insufficient") ? 403 : 400;
    return jsonError(err, status);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireAppointmentsAccess("appointments.book");
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const poll = await getMeetingPoll(auth.workspaceId, id);
    if (!poll) return NextResponse.json({ error: "Poll not found" }, { status: 404 });
    await assertPollManageAccess(
      auth.workspaceId,
      auth.session.userId,
      auth.session.email,
      poll,
    );
    await deleteMeetingPoll(auth.workspaceId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Request failed";
    const status = message.includes("permission") || message.includes("Insufficient") ? 403 : 400;
    return jsonError(err, status);
  }
}
