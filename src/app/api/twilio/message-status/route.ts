import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { markRecipientFact } from "@/lib/campaigns/sequence-runner";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

async function verify(request: Request, params: Record<string, string>) {
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    if (process.env.NODE_ENV === "production") return false;
    return !isLiveMessagingAdapter();
  }

  const tokens: string[] = [];
  const accountSid = params.AccountSid;
  if (accountSid) {
    const reg = await getPrisma().messagingRegistration.findFirst({
      where: { subaccountSid: accountSid },
    });
    if (reg?.subaccountAuthTokenEnc) {
      try {
        tokens.push(decryptSecret(reg.subaccountAuthTokenEnc));
      } catch {
        // ignore
      }
    }
  }
  const parent = getTwilioParentCredentials().authToken;
  if (parent) tokens.push(parent);
  if (!tokens.length) return process.env.NODE_ENV !== "production";
  return tokens.some((t) => validateTwilioSignature(t, signature, request.url, params));
}

/** Monotonic ranks — never downgrade (clicked is sticky via separate path). */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  sent: 2,
  undelivered: 3,
  failed: 3,
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
    const params = await parseTwilioForm(request);
    if (!(await verify(request, params))) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const sid = params.MessageSid || params.SmsSid;
    const status = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
    if (!sid) return NextResponse.json({ ok: true, skipped: true });

    const prisma = getPrisma();
    await prisma.message.updateMany({
      where: { providerId: sid },
      data: { status },
    });

    const campaignMsg = await prisma.campaignMessage.findFirst({ where: { providerId: sid } });
    if (campaignMsg) {
      const incomingRank = STATUS_RANK[status];
      if (incomingRank != null && campaignMsg.status !== "clicked") {
        // Only move status forward (or equal). Never overwrite clicked.
        await prisma.campaignMessage.updateMany({
          where: {
            id: campaignMsg.id,
            status: { in: statusesAtOrBelow(incomingRank) },
            NOT: { status: "clicked" },
          },
          data: { status },
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
        const fresh = await prisma.campaignMessage.findUnique({ where: { id: campaignMsg.id } });
        if (fresh?.deliveredCounted) {
          await markRecipientFact(campaignMsg.recipientId, "message_delivered", true);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[twilio/message-status]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
