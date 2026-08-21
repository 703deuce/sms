import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAgentTemplate } from "@/lib/voice/templates/catalog";
import { createLiveKitBrowserTestSession } from "@/lib/voice/platform/livekit-browser-test-session";
import { getPrisma } from "@/lib/db";

/** Start a browser test using a specific internal LiveKit template. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    agentId?: string;
    templateId?: string;
  };

  const templateId = body.templateId?.trim() || "livekit_basic_voice";
  const template = getAgentTemplate(templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const prisma = getPrisma();
  const agent = body.agentId
    ? await prisma.voiceAgent.findFirst({
        where: { id: body.agentId, workspaceId: session.workspaceId },
      })
    : await prisma.voiceAgent.findFirst({
        where: { workspaceId: session.workspaceId },
        orderBy: { updatedAt: "desc" },
      });

  if (!agent) {
    return NextResponse.json({ error: "No voice agent in workspace" }, { status: 404 });
  }

  const result = await createLiveKitBrowserTestSession({
    workspaceId: session.workspaceId,
    userId: session.userId,
    agentId: agent.id,
    agentTemplate: templateId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({
    data: {
      ...result.data,
      templateId,
      templateName: template.name,
      runtime: "livekit_python",
    },
  });
}
