import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getTwilioParentCredentials } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

export async function POST(request: Request) {
  try {
    const params = await parseTwilioForm(request);
    const { authToken } = getTwilioParentCredentials();
    const signature = request.headers.get("x-twilio-signature") || "";
    if (authToken && signature && !validateTwilioSignature(authToken, signature, request.url, params)) {
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
    await prisma.campaignMessage.updateMany({
      where: { providerId: sid },
      data: {
        status: ["delivered", "sent", "failed", "undelivered"].includes(status) ? status : status || "sent",
      },
    });

    if (status === "delivered") {
      const msg = await prisma.campaignMessage.findFirst({ where: { providerId: sid } });
      if (msg) {
        await prisma.campaign.update({
          where: { id: msg.campaignId },
          data: { delivered: { increment: 1 } },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[twilio/message-status]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
