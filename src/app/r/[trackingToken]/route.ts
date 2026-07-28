import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { markRecipientFact, reconcileCampaignStatus } from "@/lib/campaigns/sequence-runner";

type Ctx = { params: Promise<{ trackingToken: string }> };

/**
 * Click tracking redirect: GET /r/{token} → mark clicked → redirect to destination.
 * CAS on clickedCounted so concurrent clicks only increment analytics once.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { trackingToken } = await ctx.params;
  const prisma = getPrisma();
  const fallback = process.env.REVIEW_LINK_FALLBACK || "https://transovo.ai";

  const campaignMessage = await prisma.campaignMessage.findUnique({
    where: { trackingToken },
    include: { campaign: true, recipient: true },
  });

  if (campaignMessage) {
    const claimed = await prisma.campaignMessage.updateMany({
      where: { id: campaignMessage.id, clickedCounted: false },
      data: {
        status: "clicked",
        clickedCounted: true,
        error:
          campaignMessage.status === "clicked"
            ? campaignMessage.error
            : `was:${campaignMessage.status}`,
      },
    });

    if (claimed.count === 1) {
      await prisma.campaign.update({
        where: { id: campaignMessage.campaignId },
        data: { clicks: { increment: 1 } },
      });
      await markRecipientFact(campaignMessage.recipientId, "link_clicked", true);

      if ((campaignMessage.campaign.successMode || "click") === "click") {
        await prisma.campaignRecipient.updateMany({
          where: {
            id: campaignMessage.recipientId,
            workflowStatus: { in: ["pending", "scheduled", "in_progress", "waiting"] },
          },
          data: {
            workflowStatus: "completed",
            completedAt: new Date(),
            stopReason: "link_clicked",
            nextActionAt: null,
            enrollmentKey: null,
          },
        });
        await prisma.campaignMessage.updateMany({
          where: {
            recipientId: campaignMessage.recipientId,
            status: "queued",
            id: { not: campaignMessage.id },
          },
          data: { status: "skipped", error: "stopped: link_clicked" },
        });
        await reconcileCampaignStatus(campaignMessage.campaignId);
      }
    }

    const destination =
      campaignMessage.destinationUrl ||
      campaignMessage.body.match(/https?:\/\/\S+/)?.[0]?.replace(/[)>.,]+$/, "") ||
      fallback;
    return NextResponse.redirect(destination);
  }

  const oneOff = await prisma.message.findUnique({ where: { trackingToken } });
  if (oneOff) {
    if (oneOff.status !== "clicked") {
      await prisma.message.update({
        where: { id: oneOff.id },
        data: { status: "clicked" },
      });
    }
    const destination =
      oneOff.destinationUrl ||
      oneOff.body.match(/https?:\/\/\S+/)?.[0]?.replace(/[)>.,]+$/, "") ||
      fallback;
    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(fallback);
}
