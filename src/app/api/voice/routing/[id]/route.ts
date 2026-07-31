import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { requireVoicePermission } from "@/lib/voice/permissions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "edit_agent");
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const row = await getPrisma().voiceRoutingRule.updateMany({
      where: { id, workspaceId: auth.workspaceId },
      data: {
        name: body.name as string | undefined,
        priority: body.priority as number | undefined,
        isActive: body.isActive as boolean | undefined,
        conditions: body.conditions as object | undefined,
        actions: body.actions as object | undefined,
        agentId: body.agentId as string | null | undefined,
      },
    });
    return NextResponse.json({ data: { updated: row.count } });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireVoicePermission(auth.session.userId, auth.workspaceId, "edit_agent");
    const { id } = await params;
    await getPrisma().voiceRoutingRule.deleteMany({
      where: { id, workspaceId: auth.workspaceId },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err, 400);
  }
}
