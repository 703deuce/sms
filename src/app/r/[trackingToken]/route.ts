import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { markRecipientFact } from "@/lib/campaigns/sequence-runner";

type Ctx = { params: Promise<{ trackingToken: string }> };

/**
 * Click tracking redirect: GET /r/{token} → mark clicked → redirect to destination.
 * Resolves both campaign messages and one-off Message rows.
 * Preserves delivery status by appending ":clicked" only when not already clicked.
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
    const alreadyClicked = campaignMessage.status === "clicked" || campaignMessage.error === "clicked";
    if (!alreadyClicked) {
      // Preserve prior status in error field, mark clicked
      await prisma.campaignMessage.update({
        where: { id: campaignMessage.id },
        data: {
          status: "clicked",
          error: campaignMessage.status === "clicked" ? campaignMessage.error : `was:${campaignMessage.status}`,
        },
      });
      await prisma.campaign.update({
        where: { id: campaignMessage.campaignId },
        data: { clicks: { increment: 1 } },
      });
      await markRecipientFact(campaignMessage.recipientId, "link_clicked", true);

      if ((campaignMessage.campaign.successMode || "click") === "click") {
        await prisma.campaignRecipient.update({
          where: { id: campaignMessage.recipientId },
          data: {
            workflowStatus: "completed",
            completedAt: new Date(),
            stopReason: "link_clicked",
            nextActionAt: null,
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
