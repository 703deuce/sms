import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/api-error";
import { getContactCampaignHistory } from "@/lib/server/phone/power-dialer/contact-campaign-history";
import { resolveWorkspaceId } from "@/lib/server/workspace";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: campaignId } = await ctx.params;
    const workspaceId = await resolveWorkspaceId();
    const contactId = new URL(request.url).searchParams.get("contactId");
    if (!contactId) return NextResponse.json({ error: "contactId required" }, { status: 400 });
    const data = await getContactCampaignHistory(workspaceId, campaignId, contactId);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 404);
  }
}
