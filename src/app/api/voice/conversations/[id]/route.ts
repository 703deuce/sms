import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import * as ai from "@/lib/voice/telnyx/ai-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const prisma = getPrisma();
    const local = await prisma.voiceAiConversation.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ id }, { telnyxConversationId: id }],
      },
    });
    if (!local) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const messages = await prisma.voiceAiConversationMessage.findMany({
      where: { conversationId: local.id },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    let remote: unknown = null;
    let remoteMessages: unknown[] = [];
    if (local.telnyxConversationId && ai.isTelnyxAiConfigured()) {
      remote = await ai.getConversation(local.telnyxConversationId).catch(() => null);
      try {
        const msgsRemote = await ai.listConversationMessages(local.telnyxConversationId);
        const data = (msgsRemote as { data?: unknown[] })?.data;
        remoteMessages = Array.isArray(data)
          ? data
          : Array.isArray(msgsRemote)
            ? (msgsRemote as unknown[])
            : [];
      } catch {
        remoteMessages = [];
      }
    }
    return NextResponse.json({
      data: { conversation: local, messages, remote, remoteMessages },
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
    const body = (await request.json()) as Record<string, unknown>;
    const prisma = getPrisma();
    const local = await prisma.voiceAiConversation.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ id }, { telnyxConversationId: id }],
      },
    });
    if (!local) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (local.telnyxConversationId && ai.isTelnyxAiConfigured()) {
      await ai
        .updateConversation(local.telnyxConversationId, {
          metadata: (body.metadata as object) || undefined,
        })
        .catch(() => undefined);
    }
    const updated = await prisma.voiceAiConversation.update({
      where: { id: local.id },
      data: {
        ...(typeof body.status === "string" ? { status: body.status } : {}),
        metadata: {
          ...((local.metadata as object) || {}),
          ...((body.metadata as object) || {}),
        } as object,
      },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const prisma = getPrisma();
    const local = await prisma.voiceAiConversation.findFirst({
      where: {
        workspaceId: auth.workspaceId,
        OR: [{ id }, { telnyxConversationId: id }],
      },
    });
    if (!local) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (local.telnyxConversationId && ai.isTelnyxAiConfigured()) {
      await ai.deleteConversation(local.telnyxConversationId).catch(() => undefined);
    }
    await prisma.voiceAiConversationMessage.deleteMany({
      where: { conversationId: local.id },
    });
    await prisma.voiceAiConversation.delete({ where: { id: local.id } });
    return NextResponse.json({ data: { deleted: true, id: local.id } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
