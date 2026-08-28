import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { launchCampaignWithAudit } from "@/lib/mass-texting/campaign-launch";
import { getBroadcastCampaign } from "@/lib/mass-texting/broadcast/service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);
    const { id } = await ctx.params;
    const body = (await request.json()) as {
      idempotencyKey?: string;
      confirmLargeSend?: boolean;
    };

    const campaign = await getBroadcastCampaign(auth.workspaceId, id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const { consumeMassTextRateLimit } = await import("@/lib/mass-texting/rate-limit");
    const limited = consumeMassTextRateLimit(`launch:${auth.workspaceId}`);
    if (!limited.ok) {
      return NextResponse.json(
        { error: "Too many campaign launches. Try again in a minute." },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } },
      );
    }

    const result = await launchCampaignWithAudit({
      workspaceId: auth.workspaceId,
      campaignId: id,
      userId: auth.session.userId,
      idempotencyKey: body.idempotencyKey,
      confirmLargeSend: body.confirmLargeSend === true,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, available: result.available, required: result.required },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
