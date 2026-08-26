import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapConversation } from "@/lib/mappers";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { parseMentionsFromNote } from "@/lib/inbox/parse-mentions";
import { loadTeamMembers } from "@/lib/workspace-data";

async function loadFull(workspaceId: string, id: string) {
  return getPrisma().conversation.findFirst({
    where: { id, workspaceId },
    include: {
      contact: true,
      assignee: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
    },
  });
}

async function loadCampaignName(workspaceId: string, campaignId: string | null | undefined) {
  if (!campaignId) return null;
  const row = await getPrisma().campaign.findFirst({
    where: { id: campaignId, workspaceId },
    select: { name: true },
  });
  return row?.name ?? null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const row = await loadFull(auth.workspaceId, id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let repeatCaller: { missedToday: number; total: number } | undefined;
    const callerPhone = row.contact?.phone?.trim();
    if (callerPhone) {
      const { countCallerMissedEventsToday } = await import("@/lib/mctb/repeat-caller");
      const counts = await countCallerMissedEventsToday(auth.workspaceId, callerPhone);
      if (counts.missedToday > 1 || counts.total > 1) {
        repeatCaller = { missedToday: counts.missedToday, total: counts.total };
      }
    }

    return NextResponse.json({
      data: mapConversation({
        ...row,
        campaignName: await loadCampaignName(auth.workspaceId, row.campaignId),
        repeatCaller,
      }),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const body = (await request.json()) as {
      status?: string;
      unread?: boolean;
      assigneeId?: string | null;
      tags?: string[];
      action?: "reply" | "note" | "assign" | "status";
      body?: string;
      from?: string;
      mediaUrls?: string[];
    };

    const existing = await getPrisma().conversation.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      include: { contact: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "reply" && body.body?.trim()) {
      const to = existing.contact.phone;
      const replyFrom = body.from || existing.fromE164 || undefined;
      await sendQuickSms({
        workspaceId: auth.workspaceId,
        to,
        body: body.body.trim(),
        from: replyFrom,
        mediaUrls: body.mediaUrls?.filter(Boolean),
      });
      await getPrisma().conversationMessage.create({
        data: {
          conversationId: id,
          direction: "out",
          body: body.body.trim(),
          userName: auth.session.name,
          fromE164: replyFrom ?? null,
        },
      });
      await getPrisma().conversation.update({
        where: { id },
        data: { unread: false, status: "OPEN" },
      });
      await getPrisma().contact.update({
        where: { id: existing.contactId },
        data: { lastMessaged: new Date() },
      });
    } else if (body.action === "note" && body.body?.trim()) {
      const noteBody = body.body.trim();
      await getPrisma().conversationMessage.create({
        data: {
          conversationId: id,
          direction: "note",
          body: noteBody,
          userName: auth.session.name,
        },
      });

      const teamMembers = await loadTeamMembers(auth.workspaceId);
      const mentioned = parseMentionsFromNote(noteBody, teamMembers);
      const prisma = getPrisma();

      await prisma.auditLog.create({
        data: {
          workspaceId: auth.workspaceId,
          userId: auth.session.userId,
          event: "inbox.note",
          detail: `conversation=${id} mentions=${mentioned.map((m) => m.name).join(",") || "none"}`,
        },
      });

      for (const member of mentioned) {
        if (member.id === auth.session.userId) continue;
        await prisma.auditLog.create({
          data: {
            workspaceId: auth.workspaceId,
            userId: member.id,
            event: "inbox.mention",
            detail: `${auth.session.name} mentioned you in conversation ${id}: ${noteBody.slice(0, 120)}`,
          },
        });
      }
    } else {
      const statusMap: Record<string, "OPEN" | "PENDING" | "CLOSED" | "SNOOZED" | "SPAM"> = {
        Open: "OPEN",
        OPEN: "OPEN",
        Pending: "PENDING",
        PENDING: "PENDING",
        Closed: "CLOSED",
        CLOSED: "CLOSED",
        Snoozed: "SNOOZED",
        SNOOZED: "SNOOZED",
        Spam: "SPAM",
        SPAM: "SPAM",
      };
      await getPrisma().conversation.update({
        where: { id },
        data: {
          status: body.status ? statusMap[body.status] : undefined,
          unread: body.unread,
          assigneeId: body.assigneeId === undefined ? undefined : body.assigneeId,
          tags: body.tags,
        },
      });
    }

    const row = await loadFull(auth.workspaceId, id);
    return NextResponse.json({
      data: row
        ? mapConversation({
            ...row,
            campaignName: await loadCampaignName(auth.workspaceId, row.campaignId),
          })
        : null,
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}
