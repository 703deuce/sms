import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import {
  disableNotetakerForSession,
  enableNotetakerForAppointment,
  getMeetingSession,
} from "@/lib/meeting-assistant/service";
import {
  askMeetingQuestion,
  createMeetingShareLink,
  processMeetingSessionArtifacts,
  resetMeetingSummary,
  updateMeetingSummary,
} from "@/lib/meeting-assistant/processing";
import { publicRecapShareUrl } from "@/lib/meeting-assistant/recap-share-url";
import { getPrisma } from "@/lib/db";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const { id } = await ctx.params;
    const session = await getMeetingSession(auth.workspaceId, id);
    if (!session) return jsonEntitlementError(new Error("Meeting not found"), 404);
    return NextResponse.json({ data: session });
  } catch (err) {
    return jsonEntitlementError(err, 500);
  }
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const { id } = await ctx.params;
    const body = await request.json();
    const action = String(body.action || "");

    if (action === "enable") {
      const session = await getMeetingSession(auth.workspaceId, id);
      if (!session?.appointmentId) throw new Error("Appointment link required");
      const data = await enableNotetakerForAppointment({
        workspaceId: auth.workspaceId,
        appointmentId: session.appointmentId,
        meetingUrl: body.meetingUrl ? String(body.meetingUrl) : undefined,
      });
      return NextResponse.json({ data });
    }

    if (action === "disable") {
      const data = await disableNotetakerForSession(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (action === "update_summary") {
      const data = await updateMeetingSummary(
        auth.workspaceId,
        id,
        String(body.summaryText || ""),
      );
      return NextResponse.json({ data });
    }

    if (action === "reset_summary") {
      const data = await resetMeetingSummary(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (action === "generate_follow_up") {
      await processMeetingSessionArtifacts(id);
      const data = await getMeetingSession(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (action === "retry_processing") {
      await processMeetingSessionArtifacts(id);
      const data = await getMeetingSession(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (action === "ask") {
      const data = await askMeetingQuestion(auth.workspaceId, id, String(body.question || ""));
      return NextResponse.json({ data });
    }

    if (action === "share") {
      const expiresAt =
        body.expiresAt ? new Date(String(body.expiresAt)) : body.expiresInDays
          ? new Date(Date.now() + Number(body.expiresInDays) * 24 * 60 * 60 * 1000)
          : null;
      const share = await createMeetingShareLink({
        workspaceId: auth.workspaceId,
        sessionId: id,
        includeSummary: body.includeSummary !== false,
        includeActionItems: body.includeActionItems !== false,
        includeTranscript: body.includeTranscript === true,
        includeRecording: body.includeRecording === true,
        password: body.password ? String(body.password) : null,
        expiresAt,
      });
      return NextResponse.json({
        data: {
          ...share,
          publicUrl: publicRecapShareUrl(share.token),
        },
      });
    }

    if (action === "toggle_action_item") {
      const itemId = String(body.itemId || "");
      const completed = Boolean(body.completed);
      const prisma = getPrisma();
      await prisma.meetingActionItem.updateMany({
        where: { id: itemId, workspaceId: auth.workspaceId, meetingSessionId: id },
        data: { completed },
      });
      const data = await getMeetingSession(auth.workspaceId, id);
      return NextResponse.json({ data });
    }

    if (body.meetingUrl) {
      const prisma = getPrisma();
      const data = await prisma.meetingSession.updateMany({
        where: { id, workspaceId: auth.workspaceId },
        data: { meetingUrl: String(body.meetingUrl) },
      });
      return NextResponse.json({ data });
    }

    return jsonEntitlementError(new Error("Unknown action"), 400);
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertAiNotetakerEntitlement(auth.workspaceId);
    const { id } = await ctx.params;
    const prisma = getPrisma();
    await prisma.meetingSession.updateMany({
      where: { id, workspaceId: auth.workspaceId },
      data: { deletedAt: new Date(), status: "canceled" },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}
