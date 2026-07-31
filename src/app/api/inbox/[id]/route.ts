import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapConversation } from "@/lib/mappers";
import { sendQuickSms } from "@/lib/sms/send-quick";

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
    return NextResponse.json({ data: mapConversation(row) });
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
    };

    const existing = await getPrisma().conversation.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      include: { contact: true },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (body.action === "reply" && body.body?.trim()) {
      const to = existing.contact.phone;
      await sendQuickSms({
        workspaceId: auth.workspaceId,
        to,
        body: body.body.trim(),
        from: body.from,
      });
      await getPrisma().conversationMessage.create({
        data: {
          conversationId: id,
          direction: "out",
          body: body.body.trim(),
          userName: auth.session.name,
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
      await getPrisma().conversationMessage.create({
        data: {
          conversationId: id,
          direction: "note",
          body: body.body.trim(),
          userName: auth.session.name,
        },
      });
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
    return NextResponse.json({ data: row ? mapConversation(row) : null });
  } catch (err) {
    return jsonError(err, 400);
  }
}
