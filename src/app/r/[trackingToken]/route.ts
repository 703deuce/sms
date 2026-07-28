import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

type Ctx = { params: Promise<{ trackingToken: string }> };

/**
 * Click tracking redirect: GET /r/{token} → mark clicked → redirect to destination.
 * Destination currently stored in campaign body first URL or env REVIEW_LINK_FALLBACK.
 */
export async function GET(_request: Request, ctx: Ctx) {
  const { trackingToken } = await ctx.params;
  const prisma = getPrisma();

  const message = await prisma.campaignMessage.findUnique({
    where: { trackingToken },
    include: { campaign: true, recipient: true },
  });

  const fallback = process.env.REVIEW_LINK_FALLBACK || "https://transovo.ai";

  if (!message) {
    return NextResponse.redirect(fallback);
  }

  if (message.status !== "clicked") {
    await prisma.campaignMessage.update({
      where: { id: message.id },
      data: { status: "clicked" },
    });
    await prisma.campaign.update({
      where: { id: message.campaignId },
      data: { clicks: { increment: 1 } },
    });

    if ((message.campaign.successMode || "click") === "click") {
      await prisma.campaignRecipient.update({
        where: { id: message.recipientId },
        data: {
          workflowStatus: "completed",
          completedAt: new Date(),
          stopReason: "link_clicked",
          nextActionAt: null,
        },
      });
      await prisma.campaignMessage.updateMany({
        where: {
          recipientId: message.recipientId,
          status: "queued",
          id: { not: message.id },
        },
        data: { status: "skipped", error: "stopped: link_clicked" },
      });
    }
  }

  const urlMatch = message.body.match(/https?:\/\/\S+/);
  const destination = urlMatch?.[0]?.replace(/[)>.,]+$/, "") || fallback;
  return NextResponse.redirect(destination);
}
