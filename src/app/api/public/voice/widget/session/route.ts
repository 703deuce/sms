import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { mintWidgetSession } from "@/lib/voice/platform/widget-session";

/**
 * Mint a short-lived widget session token (no Telnyx API key to the browser).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { agentId?: string };
    const agentId = String(body.agentId || "");
    if (!agentId) {
      return NextResponse.json({ error: "agentId required" }, { status: 400 });
    }
    const prisma = getPrisma();
    const agent = await prisma.voiceAgent.findFirst({ where: { id: agentId } });
    if (!agent?.widgetEnabled || agent.emergencyDisabled) {
      return NextResponse.json({ error: "Widget unavailable" }, { status: 403 });
    }
    const cfg = await prisma.voiceWidgetConfig.findFirst({
      where: { agentId, workspaceId: agent.workspaceId },
    });
    if (!cfg) {
      return NextResponse.json({ error: "Widget not configured" }, { status: 403 });
    }
    const token = mintWidgetSession({
      agentId,
      workspaceId: agent.workspaceId,
      testMode: cfg.testMode,
    });
    return NextResponse.json({
      data: {
        token,
        expiresInSec: 900,
        agentId,
        embedPath: `/embed/voice/${agentId}`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session failed" },
      { status: 500 },
    );
  }
}
