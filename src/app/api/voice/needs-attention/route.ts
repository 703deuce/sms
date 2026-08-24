import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadNeedsAttentionItems } from "@/lib/platform/needs-attention";
import { getPrisma } from "@/lib/db";

async function markDoneForKind(
  prisma: ReturnType<typeof getPrisma>,
  workspaceId: string,
  userId: string,
  kind: string,
  id: string,
) {
  if (kind === "callback_request") {
    await prisma.callbackRequest.updateMany({
      where: { id, workspaceId },
      data: {
        status: "completed",
        completedAt: new Date(),
        completedByUserId: userId,
      },
    });
    return;
  }
  if (kind === "voicemail") {
    await prisma.voicemailMessage.updateMany({
      where: { id, workspaceId },
      data: { isResolved: true, isRead: true },
    });
    return;
  }
  if (kind === "mctb_reply" || kind === "missed_call") {
    await prisma.missedCallEvent.updateMany({
      where: { id, workspaceId },
      data: { status: "RESOLVED" },
    });
    return;
  }
  if (kind === "form_submission") {
    const row = await prisma.mctbRequestFormSubmission.findFirst({
      where: { id, workspaceId },
      select: { payloadJson: true },
    });
    if (!row) return;
    const payload =
      row.payloadJson && typeof row.payloadJson === "object" && !Array.isArray(row.payloadJson)
        ? { ...(row.payloadJson as Record<string, unknown>) }
        : {};
    payload.dismissed = true;
    payload.dismissedAt = new Date().toISOString();
    await prisma.mctbRequestFormSubmission.update({
      where: { id, workspaceId },
      data: { payloadJson: payload },
    });
  }
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const url = new URL(request.url);
    const filter = (url.searchParams.get("filter") as "all" | "assigned_to_me" | "done") || "all";
    const items = await loadNeedsAttentionItems(auth.workspaceId, {
      userId: auth.session.userId,
      filter,
    });

    const members = await getPrisma().membership.findMany({
      where: { workspaceId: auth.workspaceId },
      select: {
        userId: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      data: {
        items,
        members: members.map((m: { userId: string; user: { name: string | null; email: string } | null }) => ({
          id: m.userId,
          name: m.user?.name || m.user?.email || "Team member",
        })),
      },
    });
  } catch (err) {
    return jsonError(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = await request.json();
    const kind = String(body.kind || "");
    const id = String(body.id || "");
    const prisma = getPrisma();

    if (body.action === "assign" && kind && id) {
      const assignedToUserId = body.assignedToUserId
        ? String(body.assignedToUserId)
        : auth.session.userId;
      if (kind === "callback_request") {
        await prisma.callbackRequest.updateMany({
          where: { id, workspaceId: auth.workspaceId },
          data: { assignedToUserId },
        });
      } else if (kind === "voicemail") {
        await prisma.voicemailMessage.updateMany({
          where: { id, workspaceId: auth.workspaceId },
          data: { assignedToUserId },
        });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "mark_done" && kind && id) {
      await markDoneForKind(prisma, auth.workspaceId, auth.session.userId, kind, id);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "mark_done_all" && Array.isArray(body.events)) {
      for (const event of body.events as Array<{ kind?: string; id?: string }>) {
        if (!event.kind || !event.id) continue;
        await markDoneForKind(
          prisma,
          auth.workspaceId,
          auth.session.userId,
          event.kind,
          event.id,
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "mark_contacted" && kind === "callback_request" && id) {
      await prisma.callbackRequest.updateMany({
        where: { id, workspaceId: auth.workspaceId },
        data: { status: "contacted", contactedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    return jsonError(new Error("Unknown action"), 400);
  } catch (err) {
    return jsonError(err, 400);
  }
}
