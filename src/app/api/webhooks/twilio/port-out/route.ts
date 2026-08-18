import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import { resolveTwilioWebhookRequestUrl } from "@/lib/numbers/providers/voice/twilio-voice-webhook-auth";
import { handleTwilioPortOutWebhook } from "@/lib/numbers/twilio-port-out-service";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

function twilioPortOutProviderEventId(params: Record<string, string>) {
  const sid =
    params.port_in_phone_number_sid ||
    params.PortInPhoneNumberSid ||
    params.port_in_request_sid ||
    params.PortInRequestSid ||
    "";
  const phone = params.phone_number || params.PhoneNumber || "";
  const event = params.event_type || params.EventType || "PortOutPhoneNumberCompleted";
  const updated = params.last_date_updated || params.LastDateUpdated || "";
  if (sid) return `twilio:port-out:${sid}:${event}`;
  return `twilio:port-out:${phone}:${event}:${updated || Date.now()}`;
}

async function verifyParentTwilioSignature(request: Request, params: Record<string, string>) {
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    if (process.env.NODE_ENV === "production") return false;
    return !isLiveMessagingAdapter();
  }

  const parent = getTwilioParentCredentials().authToken;
  if (!parent) return process.env.NODE_ENV !== "production";

  const validationUrl = resolveTwilioWebhookRequestUrl(request);
  return validateTwilioSignature(parent, signature, validationUrl, params);
}

/**
 * Twilio Numbers port-out webhook (PortOutPhoneNumberCompleted, etc.)
 * Configured on parent account via numbers.v1.portingWebhookConfiguration.
 */
export async function POST(request: Request) {
  try {
    const params = await parseTwilioForm(request);
    if (!(await verifyParentTwilioSignature(request, params))) {
      console.warn("[twilio/port-out] invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const providerEventId = twilioPortOutProviderEventId(params);
    const prisma = getPrisma();

    const existing = await prisma.providerWebhookEvent.findUnique({
      where: { providerEventId },
    });
    if (existing?.status === "processed") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const payload: Record<string, unknown> = { ...params };
    const eventType =
      params.event_type || params.EventType || "PortOutPhoneNumberCompleted";

    await prisma.providerWebhookEvent.upsert({
      where: { providerEventId },
      create: {
        provider: "twilio",
        eventType: String(eventType),
        providerEventId,
        payload,
        status: "received",
      },
      update: { payload, eventType: String(eventType) },
    });

    const result = await handleTwilioPortOutWebhook(payload);

    await prisma.providerWebhookEvent.update({
      where: { providerEventId },
      data: {
        status: "processed",
        processedAt: new Date(),
        errorMessage: null,
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[twilio/port-out]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "twilio-port-out-webhook" });
}
