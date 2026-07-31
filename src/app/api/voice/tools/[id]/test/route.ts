import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { executeVoiceTool } from "@/lib/voice/tools/executor";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "manage_integrations");
    const { id } = await params;
    const body = (await request.json()) as { input?: Record<string, unknown> };

    const tool = await getPrisma().voiceTool.findFirst({
      where: { id, workspaceId: auth.workspaceId },
    });
    if (!tool) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await executeVoiceTool({
      workspaceId: auth.workspaceId,
      toolId: id,
      input: body.input || {},
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
