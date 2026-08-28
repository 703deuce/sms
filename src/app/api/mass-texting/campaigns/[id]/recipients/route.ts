import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { requireMassTextingWorkspace } from "@/lib/mass-texting/access";
import { listBroadcastRecipients } from "@/lib/mass-texting/broadcast/analytics";
import { getBroadcastCampaign } from "@/lib/mass-texting/broadcast/service";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    await requireMassTextingWorkspace(auth.workspaceId);
    const { id } = await ctx.params;

    const campaign = await getBroadcastCampaign(auth.workspaceId, id);
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const recipients = await listBroadcastRecipients(auth.workspaceId, id);
    return NextResponse.json({ data: recipients });
  } catch (err) {
    return jsonError(err, 500);
  }
}
