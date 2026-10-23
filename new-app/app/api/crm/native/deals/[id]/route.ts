import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { moveDealStage, patchDeal } from "@/lib/server/crm/native/deals";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as { stageId?: string };
    if (body.stageId) {
      const data = await moveDealStage(workspaceId, id, body.stageId);
      return NextResponse.json({ data });
    }
    const data = await patchDeal(workspaceId, id, body);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
