import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getMessagingProvider } from "@/lib/messaging/get-provider";
import { getMessagingProviderName } from "@/lib/messaging/provider-config";
import { getTelnyxPublicKey } from "@/lib/messaging/telnyx/config";
import { markRecipientFact } from "@/lib/campaigns/sequence-runner";

const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  sent: 2,
  undelivered: 3,
  failed: 3,
  expired: 3,
  delivered: 4,
  clicked: 5,
};

function statusesAtOrBelow(rank: number) {
  return Object.entries(STATUS_RANK)
    .filter(([, r]) => r <= rank)
    .map(([s]) => s);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new NextResponse("Invalid JSON", { status: 400 });
    }

    const provider = getMessagingProvider();
    const signature =
      request.headers.get("telnyx-signature-ed25519") ||
      request.headers.get("x-telnyx-signature") ||
      request.headers.get("telnyx-signature");
    const timestamp =
      request.headers.get("telnyx-timestamp") || request.headers.get("x-telnyx-timestamp");

    const verified = await provider.verifyWebhook({
      payload: rawBody,
      signature,
      timestamp,
      headers: request.headers,
    });
    if (!verified && (getMessagingProviderName() === "telnyx" || getTelnyxPublicKey())) {
      if (process.env.NODE_ENV === "production" || getTelnyxPublicKey()) {
        return new NextResponse("Invalid signature", { status: 403 });
      }
    }

    const parsed = provider.parseDeliveryStatus(payload);
    const sid = parsed.providerMessageId;
    if (!sid) return NextResponse.json({ ok: true, skipped: true });

    const status = parsed.internalStatus === "unknown" ? parsed.providerStatus.toLowerCase() : parsed.internalStatus;
    const prisma = getPrisma();

    await prisma.message.updateMany({
      where: { providerId: sid },
      data: { status },
    });

    const campaignMsg = await prisma.campaignMessage.findFirst({ where: { providerId: sid } });
    if (campaignMsg) {
      const incomingRank = STATUS_RANK[status];
      if (incomingRank != null && campaignMsg.status !== "clicked") {
        await prisma.campaignMessage.updateMany({
          where: {
            id: campaignMsg.id,
            status: { in: statusesAtOrBelow(incomingRank) },
            NOT: { status: "clicked" },
          },
          data: {
            status,
            ...(parsed.errorDetail ? { error: parsed.errorDetail } : {}),
          },
        });
      }

      if (status === "delivered") {
        await prisma.$transaction(async (tx: any) => {
          const counted = await tx.campaignMessage.updateMany({
            where: { id: campaignMsg.id, deliveredCounted: false },
            data: { deliveredCounted: true },
          });
          if (counted.count === 1) {
            await tx.campaign.update({
              where: { id: campaignMsg.campaignId },
              data: { delivered: { increment: 1 } },
            });
          }
        });
        if (campaignMsg.recipientId) {
          await markRecipientFact(campaignMsg.recipientId, "message_delivered").catch(() => undefined);
        }
      }
    }

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("[telnyx/message-status]", err);
    return new NextResponse("Status processing failed", { status: 500 });
  }
}
