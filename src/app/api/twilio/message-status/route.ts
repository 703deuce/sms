import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getTwilioParentCredentials } from "@/lib/messaging/twilio-config";
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
    return !(process.env.TWILIO_MODE === "live" || process.env.MESSAGING_ADAPTER === "twilio");
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
      const prev = campaignMsg.status;
      // Never downgrade clicked — click is terminal for UX/analytics
      if (prev !== "clicked") {
        await prisma.campaignMessage.update({
          where: { id: campaignMsg.id },
          data: {
            status: ["delivered", "sent", "failed", "undelivered"].includes(status)
              ? status
              : status || campaignMsg.status,
          },
        });
      }

      if (status === "delivered" && prev !== "clicked") {
        if (prev !== "delivered") {
          await prisma.campaign.update({
            where: { id: campaignMsg.campaignId },
            data: { delivered: { increment: 1 } },
          });
          await markRecipientFact(campaignMsg.recipientId, "message_delivered", true);
        }
      } else if (status === "delivered" && prev === "clicked") {
        // Count delivery once if we never recorded it before click
        const was = campaignMsg.error || "";
        const alreadyCounted =
          was.includes("delivered_counted") ||
          was.includes("was:delivered") ||
          was.includes("was:sent");
        if (!alreadyCounted) {
          await prisma.campaign.update({
            where: { id: campaignMsg.campaignId },
            data: { delivered: { increment: 1 } },
          });
          await prisma.campaignMessage.update({
            where: { id: campaignMsg.id },
            data: { error: `${was}|delivered_counted` },
          });
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
