import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertAiNotetakerEntitlement } from "@/lib/meeting-assistant/entitlements";
import {
  disableNotetakerForSession,
  enableNotetakerForAppointment,
  getMeetingSession,
  rescheduleStandaloneMeetingSession,
} from "@/lib/meeting-assistant/service";
import {
  askMeetingQuestion,
  createMeetingShareLink,
  listMeetingRecapShares,
  processMeetingSessionArtifacts,
  resetMeetingSummary,
  revokeMeetingRecapShare,
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
    const shares = (session.shares || []).map((share: {
      id: string;
      token: string;
      includeSummary: boolean;
      includeActionItems: boolean;
      includeTranscript: boolean;
      includeRecording: boolean;
      expiresAt: Date | null;
      revokedAt: Date | null;
      createdAt: Date;
    }) => ({
      id: share.id,
      token: share.token,
      publicUrl: publicRecapShareUrl(share.token),
      includeSummary: share.includeSummary,
      includeActionItems: share.includeActionItems,
      includeTranscript: share.includeTranscript,
      includeRecording: share.includeRecording,
      expiresAt: share.expiresAt?.toISOString() || null,
      revokedAt: share.revokedAt?.toISOString() || null,
      createdAt: share.createdAt.toISOString(),
      status:
        share.revokedAt
          ? "revoked"
          : share.expiresAt && share.expiresAt.getTime() < Date.now()
            ? "expired"
            : "active",
    }));
    const { shares: _shares, ...sessionData } = session;
    return NextResponse.json({ data: { ...sessionData, recapShares: shares } });
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

    if (action === "send_follow_up") {
      const session = await getMeetingSession(auth.workspaceId, id);
      if (!session?.followUpEmailDraft) throw new Error("No follow-up draft to send");
      const to = body.to ? String(body.to) : undefined;
      const prisma = (await import("@/lib/db")).getPrisma();
      let recipient = to;
      if (!recipient && session.appointmentId) {
        const appt = await prisma.voiceAppointment.findFirst({
          where: { id: session.appointmentId, workspaceId: auth.workspaceId },
          select: { inviteeEmail: true },
        });
        recipient = appt?.inviteeEmail || undefined;
      }
      if (!recipient) throw new Error("Recipient email required");
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      await sendTransactionalEmail({
        workspaceId: auth.workspaceId,
        to: recipient,
        subject: String(body.subject || `Follow-up: ${session.title || "Meeting"}`),
        html: session.followUpEmailDraft.replace(/\n/g, "<br/>"),
      });
      const data = await getMeetingSession(auth.workspaceId, id);
      return NextResponse.json({ data: { ...data, followUpStatus: "sent" } });
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

    if (action === "revoke_share") {
      const shareId = String(body.shareId || "");
      if (!shareId) throw new Error("shareId is required");
      await revokeMeetingRecapShare(auth.workspaceId, shareId);
      const shares = await listMeetingRecapShares(auth.workspaceId, id);
      return NextResponse.json({
        data: {
          shares: shares.map((share: {
            id: string;
            token: string;
            expiresAt: Date | null;
            revokedAt: Date | null;
            createdAt: Date;
          }) => ({
            id: share.id,
            token: share.token,
            publicUrl: publicRecapShareUrl(share.token),
            expiresAt: share.expiresAt?.toISOString() || null,
            revokedAt: share.revokedAt?.toISOString() || null,
            createdAt: share.createdAt.toISOString(),
            status:
              share.revokedAt
                ? "revoked"
                : share.expiresAt && share.expiresAt.getTime() < Date.now()
                  ? "expired"
                  : "active",
          })),
        },
      });
    }

    if (action === "reschedule") {
      const scheduledStartAt = new Date(String(body.scheduledStartAt || ""));
      if (Number.isNaN(scheduledStartAt.getTime())) {
        throw new Error("scheduledStartAt is required");
      }
      const session = await getMeetingSession(auth.workspaceId, id);
      if (!session) throw new Error("Meeting not found");
      if (session.appointmentId) throw new Error("Reschedule from the appointment instead");
      if (session.meetingSource === "transovo_video" && session.videoMeetingId) {
        const { rescheduleStandaloneVideoMeeting } = await import("@/lib/transovo-video/service");
        await rescheduleStandaloneVideoMeeting({
          workspaceId: auth.workspaceId,
          videoMeetingId: session.videoMeetingId,
          scheduledStartAt,
          scheduledEndAt: body.scheduledEndAt ? new Date(String(body.scheduledEndAt)) : undefined,
          durationMinutes: body.durationMinutes ? Number(body.durationMinutes) : undefined,
        });
      } else {
        await rescheduleStandaloneMeetingSession({
          workspaceId: auth.workspaceId,
          sessionId: id,
          scheduledStartAt,
        });
      }
      const data = await getMeetingSession(auth.workspaceId, id);
      return NextResponse.json({ data });
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
    const session = await getMeetingSession(auth.workspaceId, id);
    if (
      session?.meetingSource === "transovo_video" &&
      session.videoMeetingId &&
      !session.appointmentId
    ) {
      const { cancelStandaloneVideoMeeting } = await import("@/lib/transovo-video/service");
      await cancelStandaloneVideoMeeting(auth.workspaceId, session.videoMeetingId);
      return NextResponse.json({ ok: true });
    }
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
