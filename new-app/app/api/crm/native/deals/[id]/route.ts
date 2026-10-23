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
    let data = null as Awaited<ReturnType<typeof patchDeal>> | null;
    if (stageId) data = await moveDealStage(workspaceId, id, stageId);
    if (Object.keys(patch).length > 0) data = await patchDeal(workspaceId, id, patch);
    if (!data) throw new Error("No changes");
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
