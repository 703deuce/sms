import { NextResponse } from "next/server";
import { jsonEntitlementError, requireSession } from "@/lib/api-auth";
import { assertTransovoVideoEntitlement } from "@/lib/transovo-video/entitlements";
import {
  buildVideoInviteEmail,
  buildVideoInviteText,
  resolveVideoMeetingJoinUrl,
} from "@/lib/transovo-video/invite";
import { getVideoMeeting } from "@/lib/transovo-video/service";
import { getPrisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await assertTransovoVideoEntitlement(auth.workspaceId);

    const { id } = await context.params;
    const meeting = await getVideoMeeting(auth.workspaceId, id);
    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const body = await request.json();
    const channel = String(body.channel || "");
    const to = String(body.to || "").trim();
    if (!to) {
      return NextResponse.json({ error: "Recipient is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const workspace = await prisma.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { name: true, displayName: true },
    });
    const businessName = workspace?.displayName || workspace?.name || "Transovo";
    const joinUrl = resolveVideoMeetingJoinUrl(meeting.publicMeetingToken);
    const title = meeting.title || "Transovo Video meeting";

    if (channel === "sms") {
      const { sendQuickSms } = await import("@/lib/sms/send-quick");
      await sendQuickSms({
        workspaceId: auth.workspaceId,
        to,
        body: buildVideoInviteText({
          title,
          joinUrl,
          scheduledStartAt: meeting.scheduledStartAt,
          businessName,
        }),
      });
      return NextResponse.json({ ok: true, channel: "sms" });
    }

    if (channel === "email") {
      const email = buildVideoInviteEmail({
        title,
        joinUrl,
        scheduledStartAt: meeting.scheduledStartAt,
        businessName,
      });
      const { sendTransactionalEmail } = await import("@/lib/email/brevo");
      const result = await sendTransactionalEmail({
        to,
        subject: email.subject,
        htmlContent: email.htmlContent,
        textContent: email.textContent,
      });
      if (result.status === "failed") {
        return NextResponse.json({ error: result.error || "Email failed" }, { status: 400 });
      }
      return NextResponse.json({ ok: true, channel: "email", provider: result.provider });
    }

    return NextResponse.json({ error: "channel must be email or sms" }, { status: 400 });
  } catch (err) {
    return jsonEntitlementError(err, 400);
  }
}
