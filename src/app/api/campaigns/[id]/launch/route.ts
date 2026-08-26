import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { launchCampaignWithAudit } from "@/lib/mass-texting/campaign-launch";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      idempotencyKey?: string;
      confirmLargeSend?: boolean;
    };

    const campaign = await getPrisma().campaign.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      select: { id: true },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    await requireMassTextingWorkspace(auth.workspaceId);

    const idempotencyKey =
      body.idempotencyKey?.trim() || `launch:${auth.workspaceId}:${id}:${Date.now()}`;

    const result = await launchCampaignWithAudit({
      workspaceId: auth.workspaceId,
      campaignId: id,
      userId: auth.session.userId,
      idempotencyKey,
      confirmLargeSend: body.confirmLargeSend === true,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
