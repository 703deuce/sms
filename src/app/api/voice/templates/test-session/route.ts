import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { createLiveKitBrowserTestSession } from "@/lib/voice/platform/livekit-browser-test-session";
import { getAgentTemplate } from "@/lib/voice/templates/catalog";

/** Start a browser test using a specific internal LiveKit template. */
export async function POST(request: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    agentId?: string;
    templateId?: string;
  };

  const templateId = body.templateId?.trim() || "livekit_basic_voice";
  const template = getAgentTemplate(templateId);
  if (!template) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }
  if (
    templateId === "transovo_receptionist_v1" &&
    process.env.ALLOW_COMPOSED_RECEPTIONIST !== "1"
  ) {
    return NextResponse.json(
      {
        error:
          "transovo_receptionist_v1 is COMPOSED_UNVERIFIED — verify reference templates first or set ALLOW_COMPOSED_RECEPTIONIST=1",
      },
      { status: 403 },
    );
  }

  const prisma = getPrisma();
  const agent = body.agentId
    ? await prisma.voiceAgent.findFirst({
        where: { id: body.agentId, workspaceId: auth.workspaceId },
      })
    : await prisma.voiceAgent.findFirst({
        where: { workspaceId: auth.workspaceId },
        orderBy: { updatedAt: "desc" },
      });

  if (!agent) {
    return NextResponse.json({ error: "No voice agent in workspace" }, { status: 404 });
  }

  const result = await createLiveKitBrowserTestSession({
    workspaceId: auth.workspaceId,
    userId: auth.session.userId,
    agentId: agent.id,
    agentTemplate: templateId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: result.status });
  }

  return NextResponse.json({
    data: {
      sessionId: result.sessionId,
      agentId: result.agentId,
      telnyxAssistantId: result.telnyxAssistantId,
      webrtc: result.webrtc,
      voice: result.voice,
      synced: result.synced,
      expiresAt: result.expiresAt,
      testVariables: result.testVariables,
      livekit: result.livekit,
      templateId,
      templateName: template.name,
      runtime: "livekit_python",
    },
  });
}
