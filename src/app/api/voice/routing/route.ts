import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const rows = await getPrisma().voiceRoutingRule.findMany({
      where: { workspaceId: auth.workspaceId },
      orderBy: { priority: "asc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "edit_agent");
    const body = (await request.json()) as {
      name?: string;
      agentId?: string;
      priority?: number;
      conditions?: Record<string, unknown>;
      actions?: Record<string, unknown>;
    };
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }
    const row = await getPrisma().voiceRoutingRule.create({
      data: {
        workspaceId: auth.workspaceId,
        name: body.name.trim(),
        agentId: body.agentId || null,
        priority: body.priority ?? 0,
        conditions: body.conditions || {},
        actions: body.actions || { type: "ai_answer" },
      },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
