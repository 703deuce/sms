import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";
import {
  admitVideoParticipant,
  cancelStandaloneVideoMeeting,
  declineVideoParticipant,
  endVideoMeetingForEveryone,
  getVideoMeeting,
  lockVideoMeeting,
  moderateVideoParticipant,
  rescheduleStandaloneVideoMeeting,
  unlockVideoMeeting,
} from "@/lib/transovo-video/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);
    const { id } = await context.params;
    const meeting = await getVideoMeeting(auth.workspaceId, id);
    if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ data: { meeting } });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    switch (action) {
      case "admit":
        await admitVideoParticipant({
          workspaceId: auth.workspaceId,
          videoMeetingId: id,
          participantId: String(body.participantId),
          hostUserId: auth.session.userId,
          hostEmail: auth.session.email,
        });
        break;
      case "decline":
        await declineVideoParticipant({
          workspaceId: auth.workspaceId,
          videoMeetingId: id,
          participantId: String(body.participantId),
          hostUserId: auth.session.userId,
          hostEmail: auth.session.email,
        });
        break;
      case "mute":
      case "unmute":
      case "remove":
        await moderateVideoParticipant({
          workspaceId: auth.workspaceId,
          videoMeetingId: id,
          participantId: String(body.participantId),
          action: action as "mute" | "unmute" | "remove",
          hostUserId: auth.session.userId,
          hostEmail: auth.session.email,
        });
        break;
      case "lock":
        await lockVideoMeeting(auth.workspaceId, id);
        break;
      case "unlock":
        await unlockVideoMeeting(auth.workspaceId, id);
        break;
      case "end":
        await endVideoMeetingForEveryone({
          workspaceId: auth.workspaceId,
          videoMeetingId: id,
          hostUserId: auth.session.userId,
          hostEmail: auth.session.email,
        });
        break;
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    const meeting = await getVideoMeeting(auth.workspaceId, id);
    return NextResponse.json({ data: { meeting } });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "reschedule") {
      const scheduledStartAt = new Date(String(body.scheduledStartAt || ""));
      if (Number.isNaN(scheduledStartAt.getTime())) {
        return NextResponse.json({ error: "scheduledStartAt is required" }, { status: 400 });
      }
      const meeting = await rescheduleStandaloneVideoMeeting({
        workspaceId: auth.workspaceId,
        videoMeetingId: id,
        scheduledStartAt,
        scheduledEndAt: body.scheduledEndAt ? new Date(String(body.scheduledEndAt)) : undefined,
        durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
      });
      return NextResponse.json({ data: { meeting } });
    }

    if (action === "cancel") {
      const meeting = await cancelStandaloneVideoMeeting(auth.workspaceId, id);
      return NextResponse.json({ data: { meeting } });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}
