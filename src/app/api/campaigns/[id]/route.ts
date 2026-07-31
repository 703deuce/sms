import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { mapCampaign } from "@/lib/mappers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { id } = await params;
    const campaign = await getPrisma().campaign.findFirst({
      where: { id, workspaceId: auth.workspaceId },
      include: {
        _count: { select: { recipients: true, campaignMessages: true } },
      },
    });
    if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const recentMessages = await getPrisma().campaignMessage.findMany({
      where: { campaignId: id, workspaceId: auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      data: {
        ...mapCampaign(campaign),
        category: campaign.category,
        sequenceJson: campaign.sequenceJson,
        configJson: campaign.configJson,
        recipientCount: campaign._count.recipients,
        messageCount: campaign._count.campaignMessages,
        recentMessages,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
