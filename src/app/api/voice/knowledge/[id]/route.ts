import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const kb = await getPrisma().voiceKnowledgeBase.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!kb) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const sources = await getPrisma().voiceKnowledgeSource.findMany({
      where: { knowledgeBaseId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: { ...kb, sources } });
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
    const existing = await prisma.voiceKnowledgeBase.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const updated = await prisma.voiceKnowledgeBase.update({
      where: { id },
      data: {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(typeof body.status === "string" ? { status: body.status } : {}),
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
    const existing = await prisma.voiceKnowledgeBase.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.voiceAgentKnowledgeBase.deleteMany({
      where: { knowledgeBaseId: id, workspaceId: auth.workspaceId },
    });
    await prisma.voiceKnowledgeSource.deleteMany({ where: { knowledgeBaseId: id } });
    await prisma.voiceKnowledgeBase.delete({ where: { id } });
    return NextResponse.json({ data: { deleted: true, id } });
  } catch (err) {
    return jsonError(err, 500);
  }
}
