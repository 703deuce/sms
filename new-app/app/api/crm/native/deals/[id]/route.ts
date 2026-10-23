import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { moveDealStage, patchDeal } from "@/lib/server/crm/native/deals";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const body = (await request.json()) as {
      stageId?: string;
      title?: string;
      amountCents?: number | null;
      ownerUserId?: string | null;
      closeTargetAt?: string | null;
      nextStep?: string | null;
      contactId?: string | null;
      companyId?: string | null;
    };
    const { stageId, ...patch } = body;
    if (stageId) {
      const data = await moveDealStage(workspaceId, id, stageId);
      return NextResponse.json({ data });
    }
    const data = await patchDeal(workspaceId, id, patch);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
