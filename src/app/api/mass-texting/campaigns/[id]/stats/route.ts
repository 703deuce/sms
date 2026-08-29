import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { loadCampaignLiveStats } from "@/lib/analytics/messaging-analytics";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);
    const { id } = await ctx.params;

    const stats = await loadCampaignLiveStats(auth.workspaceId, id);
    if (!stats) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    return NextResponse.json({ data: stats });
  } catch (err) {
    return jsonError(err, 500);
  }
}
