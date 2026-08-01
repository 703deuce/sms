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
    const { id: agentId } = await params;
    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const links = await getPrisma().voiceAgentKnowledgeBase.findMany({
      where: { agentId, workspaceId: auth.workspaceId },
      include: {
        knowledgeBase: {
          select: {
            id: true,
            name: true,
            status: true,
            telnyxBucketName: true,
            telnyxEmbeddingStatus: true,
          },
        },
      },
    });
    return NextResponse.json({
      data: links.map((l: (typeof links)[number]) => ({
        id: l.id,
        knowledgeBaseId: l.knowledgeBaseId,
        ...l.knowledgeBase,
      })),
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id: agentId } = await params;
    const body = (await request.json()) as { knowledgeBaseIds?: string[] };
    const ids = body.knowledgeBaseIds || [];

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await getPrisma().voiceAgentKnowledgeBase.deleteMany({
      where: { agentId, workspaceId: auth.workspaceId },
    });
    for (const knowledgeBaseId of ids) {
      const kb = await getPrisma().voiceKnowledgeBase.findFirst({
        where: { id: knowledgeBaseId, workspaceId: auth.workspaceId },
      });
      if (!kb) continue;
      await getPrisma().voiceAgentKnowledgeBase.create({
        data: {
          workspaceId: auth.workspaceId,
          agentId,
          knowledgeBaseId,
        },
      });
    }

    // Persist on draft config too
    const draft = (agent.draftConfig || {}) as Record<string, unknown>;
    await getPrisma().voiceAgent.update({
      where: { id: agentId },
      data: { draftConfig: { ...draft, knowledgeBaseIds: ids } },
    });

    return NextResponse.json({ data: { knowledgeBaseIds: ids } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
