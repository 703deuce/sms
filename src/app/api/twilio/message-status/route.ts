import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { applyOutboundDeliveryStatus } from "@/lib/messaging/delivery-status";

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

export async function POST(request: Request) {
  try {
    const params = await parseTwilioForm(request);
    if (!(await verify(request, params))) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    const sid = params.MessageSid || params.SmsSid;
    const status = (params.MessageStatus || params.SmsStatus || "").toLowerCase();
    if (!sid) return NextResponse.json({ ok: true, skipped: true });

    const result = await applyOutboundDeliveryStatus({
      providerMessageId: sid,
      status,
      providerStatus: params.MessageStatus || params.SmsStatus || null,
      errorCode: params.ErrorCode || null,
      errorDetail: params.ErrorMessage || null,
      provider: "twilio",
    });

    const { bridgeMctbRecoveryDeliveryWebhook } = await import(
      "@/lib/mctb/messaging/delivery-trace"
    );
    await bridgeMctbRecoveryDeliveryWebhook({
      providerMessageId: sid,
      status: result.status,
      errorDetail: params.ErrorMessage || null,
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[twilio/message-status]", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
