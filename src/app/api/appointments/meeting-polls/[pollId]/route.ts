import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  addPollOption,
  addPollParticipant,
  archivePollOption,
  cancelMeetingPoll,
  closeMeetingPoll,
  duplicateMeetingPoll,
  getMeetingPoll,
  openMeetingPoll,
  recordPollReminder,
  saveMeetingPoll,
} from "@/lib/appointments/meeting-polls";
import { finalizeMeetingPoll } from "@/lib/appointments/meeting-polls/finalize";
import { scoreMeetingPoll } from "@/lib/appointments/meeting-polls/scoring";
import { derivePollStatus, publicPollUrl } from "@/lib/appointments/meeting-polls/model";
import { getPrisma } from "@/lib/db";

type Params = { params: Promise<{ pollId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { pollId } = await params;
    const poll = await getMeetingPoll(auth.workspaceId, pollId);
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { slug: true },
    });
    return NextResponse.json({
      data: {
        poll,
        derivedStatus: derivePollStatus(poll),
        scoreboard: scoreMeetingPoll(poll),
        publicUrl: workspace?.slug ? publicPollUrl(workspace.slug, poll.shareToken) : "",
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { pollId } = await params;
    const body = (await request.json()) as {
      action?: string;
      poll?: Parameters<typeof saveMeetingPoll>[1];
      optionId?: string;
      idempotencyKey?: string;
      forceDespiteConflicts?: boolean;
      option?: { startsAt: string; endsAt: string };
      participant?: { name: string; email: string; contactId?: string };
      organizerStaffId?: string;
    };

    if (body.action === "save" && body.poll) {
      const saved = await saveMeetingPoll(auth.workspaceId, body.poll);
      return NextResponse.json({ data: saved });
    }

    if (body.action === "close") {
      const saved = await closeMeetingPoll(auth.workspaceId, pollId);
      return NextResponse.json({ data: saved });
    }
    if (body.action === "cancel") {
      const saved = await cancelMeetingPoll(auth.workspaceId, pollId);
      return NextResponse.json({ data: saved });
    }
    if (body.action === "open") {
      const saved = await openMeetingPoll(auth.workspaceId, pollId);
      return NextResponse.json({ data: saved });
    }
    if (body.action === "duplicate") {
      const saved = await duplicateMeetingPoll(auth.workspaceId, pollId);
      return NextResponse.json({ data: saved }, { status: 201 });
    }
    if (body.action === "add_option" && body.option) {
      const saved = await addPollOption(auth.workspaceId, pollId, body.option);
      return NextResponse.json({ data: saved });
    }
    if (body.action === "remove_option" && body.optionId) {
      const saved = await archivePollOption(auth.workspaceId, pollId, body.optionId);
      return NextResponse.json({ data: saved });
    }
    if (body.action === "add_participant" && body.participant) {
      const saved = await addPollParticipant(auth.workspaceId, pollId, body.participant);
      return NextResponse.json({ data: saved });
    }
    if (body.action === "remind") {
      const poll = await getMeetingPoll(auth.workspaceId, pollId);
      if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const responded = new Set(poll.responses.map((r) => r.participantId));
      const pending = poll.participants.filter((p) => p.status !== "removed" && !responded.has(p.id));
      const saved = await recordPollReminder(auth.workspaceId, pollId, pending.map((p) => p.email));
      return NextResponse.json({ data: saved, reminded: pending.length });
    }
    if (body.action === "finalize" && body.optionId) {
      const poll = await getMeetingPoll(auth.workspaceId, pollId);
      if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
      const key = body.idempotencyKey || `finalize:${pollId}:${body.optionId}`;
      const result = await finalizeMeetingPoll({
        workspaceId: auth.workspaceId,
        poll,
        optionId: body.optionId,
        idempotencyKey: key,
        organizerStaffId: body.organizerStaffId,
        forceDespiteConflicts: body.forceDespiteConflicts,
      });
      if (!result.ok) {
        return NextResponse.json({ error: result.message, code: result.code, appointmentId: result.appointmentId }, { status: 409 });
      }
      const saved = await saveMeetingPoll(auth.workspaceId, result.poll);
      return NextResponse.json({ data: saved, appointmentId: result.appointmentId });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
