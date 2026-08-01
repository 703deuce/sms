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
    const links = await getPrisma().voiceAgentTool.findMany({
      where: { agentId, workspaceId: auth.workspaceId },
      include: {
        tool: {
          select: { id: true, name: true, toolType: true, status: true, description: true },
        },
      },
    });
    return NextResponse.json({
      data: links.map((l: (typeof links)[number]) => ({
        id: l.id,
        toolId: l.toolId,
        ...l.tool,
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
    const body = (await request.json()) as { toolIds?: string[] };
    const ids = body.toolIds || [];

    const agent = await getPrisma().voiceAgent.findFirst({
      where: { id: agentId, workspaceId: auth.workspaceId },
    });
    if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await getPrisma().voiceAgentTool.deleteMany({
      where: { agentId, workspaceId: auth.workspaceId },
    });
    for (const toolId of ids) {
      const tool = await getPrisma().voiceTool.findFirst({
        where: { id: toolId, workspaceId: auth.workspaceId },
      });
      if (!tool) continue;
      await getPrisma().voiceAgentTool.create({
        data: { workspaceId: auth.workspaceId, agentId, toolId },
      });
    }

    const draft = (agent.draftConfig || {}) as Record<string, unknown>;
    await getPrisma().voiceAgent.update({
      where: { id: agentId },
      data: { draftConfig: { ...draft, toolIds: ids } },
    });

    return NextResponse.json({ data: { toolIds: ids } });
  } catch (err) {
    return jsonError(err, 400);
  }
}
