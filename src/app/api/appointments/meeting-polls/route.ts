import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import {
  createMeetingPoll,
  listMeetingPolls,
  saveMeetingPoll,
} from "@/lib/appointments/meeting-polls";
import { publicPollUrl } from "@/lib/appointments/meeting-polls/model";
import { getPrisma } from "@/lib/db";

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
      title?: string;
      description?: string;
      appointmentTypeId?: string;
      timezone?: string;
      durationMinutes?: number;
      meetingMethod?: "video" | "phone" | "in_person" | "custom";
      location?: string;
      deadlineAt?: string;
      options?: Array<{ startsAt: string; endsAt: string }>;
      participants?: Array<{ name: string; email: string; contactId?: string }>;
      settings?: Partial<import("@/lib/appointments/scheduling-capabilities").MeetingPollSettings>;
      openImmediately?: boolean;
      poll?: Parameters<typeof saveMeetingPoll>[1];
    };

    if (body.poll) {
      const saved = await saveMeetingPoll(auth.workspaceId, body.poll);
      return NextResponse.json({ data: saved });
    }

    const poll = createMeetingPoll({
      workspaceId: auth.workspaceId,
      title: body.title || "Meeting poll",
      description: body.description,
      appointmentTypeId: body.appointmentTypeId,
      timezone: body.timezone,
      durationMinutes: body.durationMinutes,
      meetingMethod: body.meetingMethod,
      location: body.location,
      deadlineAt: body.deadlineAt,
      options: body.options || [],
      participants: body.participants,
      settings: body.settings,
      openImmediately: body.openImmediately,
      organizerUserId: auth.session.userId,
    });
    const saved = await saveMeetingPoll(auth.workspaceId, poll);
    const workspace = await getPrisma().workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { slug: true },
    });
    const publicUrl = workspace?.slug ? publicPollUrl(workspace.slug, saved.shareToken) : "";
    return NextResponse.json({ data: saved, publicUrl }, { status: 201 });
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
