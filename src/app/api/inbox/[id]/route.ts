import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapConversation } from "@/lib/mappers";
import type { Conversation } from "@/lib/types";
import { sendQuickSms } from "@/lib/sms/send-quick";
import { parseMentionsFromNote } from "@/lib/inbox/parse-mentions";
import { loadTeamMembers } from "@/lib/workspace-data";
import { assertInboxEnabled } from "@/lib/inbox/inbox-access";

async function loadFull(workspaceId: string, id: string) {
  const row = await getPrisma().conversation.findFirst({
    where: { id, workspaceId },
    include: {
      contact: true,
      assignee: { select: { id: true, name: true, email: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });
  if (!row) return null;
  return { ...row, messages: [...row.messages].reverse() };
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
    await assertInboxEnabled(auth.workspaceId);
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

    let appointmentContext: Conversation["appointmentContext"];
    if (row.contactId) {
      const { loadUpcomingAppointmentsByContactIds } = await import("@/lib/appointments/analytics");
      const map = await loadUpcomingAppointmentsByContactIds(auth.workspaceId, [row.contactId]);
      const appt = map.get(row.contactId);
      if (appt) {
        appointmentContext = {
          id: appt.id,
          serviceName: appt.serviceName,
          startsAt: appt.startsAt.toISOString(),
          label: `${appt.serviceName || "Appointment"} — ${appt.startsAt.toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`,
        };
      }
    }

    return NextResponse.json({
      data: mapConversation({
        ...row,
        campaignName: await loadCampaignName(auth.workspaceId, row.campaignId),
        repeatCaller,
        appointmentContext,
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

    const { getMessagingRuntimeSettings, resolveInboxPermissions } =
      await import("@/lib/messaging/messaging-settings");
    const runtime = await getMessagingRuntimeSettings(auth.workspaceId);
    const perms = resolveInboxPermissions(runtime.inboxPermissionsJson);
    if (perms.inboxEnabled === false) {
      return NextResponse.json({ error: "Inbox is disabled for this workspace" }, { status: 403 });
    }

    const replyMedia = body.mediaUrls?.filter(Boolean) ?? [];
    const replyBody = body.body?.trim() ?? "";
    if (body.action === "reply" && (replyBody || replyMedia.length)) {
      if (perms.allowStartConversations === false && existing.status === "CLOSED") {
        return NextResponse.json({ error: "Cannot reply to closed conversations" }, { status: 403 });
      }
      const to = existing.contact.phone;
      const replyFrom = body.from || existing.fromE164 || undefined;
      await sendQuickSms({
        workspaceId: auth.workspaceId,
        to,
        body: replyBody,
        from: replyFrom,
        mediaUrls: replyMedia.length ? replyMedia : undefined,
      });
      await getPrisma().conversationMessage.create({
        data: {
          conversationId: id,
          direction: "out",
          body: replyBody || (replyMedia.length ? "" : ""),
          mediaUrls: replyMedia,
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
      const previous = {
        status: existing.status,
        assigneeId: existing.assigneeId,
        tags: existing.tags || [],
        unread: existing.unread,
      };
      const nextStatus = body.status ? statusMap[body.status] : undefined;

      const { getMessagingRuntimeSettings, resolveInboxPermissions } =
        await import("@/lib/messaging/messaging-settings");
      const runtime = await getMessagingRuntimeSettings(auth.workspaceId);
      const perms = resolveInboxPermissions(runtime.inboxPermissionsJson);
      const tagDefs = Array.isArray(runtime.inboxTagsJson) ? runtime.inboxTagsJson : [];

      if (body.assigneeId !== undefined && perms.allowAssignment === false) {
        return NextResponse.json({ error: "Conversation assignment is disabled" }, { status: 403 });
      }
      if (body.tags !== undefined && perms.allowTagging === false) {
        return NextResponse.json({ error: "Conversation tagging is disabled" }, { status: 403 });
      }

      let assigneeId =
        body.assigneeId === undefined ? existing.assigneeId : body.assigneeId;
      let unread = body.unread === undefined ? existing.unread : body.unread;
      let tags = body.tags ?? existing.tags ?? [];

      if (nextStatus === "CLOSED" && perms.unassignOnClose) {
        assigneeId = null;
      }

      if (
        body.assigneeId !== undefined &&
        body.assigneeId !== existing.assigneeId &&
        body.assigneeId &&
        perms.markUnreadOnAssign
      ) {
        unread = true;
      }

      if (nextStatus === "CLOSED") {
        const untagNames = new Set(
          tagDefs.filter((t: { untagOnClose?: boolean; name: string }) => t.untagOnClose).map((t) => t.name),
        );
        if (untagNames.size) {
          tags = tags.filter((t) => !untagNames.has(t));
        }
      }

      await getPrisma().conversation.update({
        where: { id },
        data: {
          status: nextStatus,
          unread,
          assigneeId,
          tags: body.tags !== undefined || nextStatus === "CLOSED" ? tags : undefined,
        },
      });
      try {
        const { emitInboxAutomationEvents } = await import(
          "@/lib/automations/parity/inbox-events"
        );
        await emitInboxAutomationEvents({
          workspaceId: auth.workspaceId,
          contactId: existing.contactId,
          conversationId: id,
          previous,
          next: {
            status: nextStatus ?? previous.status,
            assigneeId: body.assigneeId === undefined ? previous.assigneeId : body.assigneeId,
            tags: body.tags ?? previous.tags,
            unread: body.unread ?? previous.unread,
          },
        });
      } catch {
        /* non-fatal */
      }
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
