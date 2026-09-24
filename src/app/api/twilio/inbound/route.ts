import { NextResponse } from "next/server";
import { processInboundMessage, resolveInboundContext } from "@/lib/messaging/inbound-process";
import { verifyTwilioSmsWebhookSignature } from "@/lib/messaging/twilio-sms-webhook-auth";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

async function verifySignature(
  request: Request,
  params: Record<string, string>,
  registration: { subaccountAuthTokenEnc: string | null } | null | undefined,
) {
  return verifyTwilioSmsWebhookSignature(request, params, registration);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function twimlMessage(body?: string, mediaUrls?: string[]) {
  if (!body) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  }
  const media = (mediaUrls || [])
    .filter(Boolean)
    .map((url) => `<Media>${escapeXml(url)}</Media>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(body)}${media}</Message></Response>`;
}

export async function POST(request: Request) {
  try {
    const params = await parseTwilioForm(request);
    let from = "";
    try {
      from = params.From ? normalizeE164(params.From) : "";
    } catch {
      from = params.From || "";
    }
    const to = params.To || "";
    const body = (params.Body || "").trim();

    const { isActiveMctbPlatformSenderE164 } = await import(
      "@/lib/mctb/messaging/platform-sender-config"
    );
    const platformTo = await isActiveMctbPlatformSenderE164(to);

    const ctx = platformTo
      ? null
      : await resolveInboundContext(to, params.AccountSid, { fromE164: from, body });
    if (!(await verifySignature(request, params, ctx?.registration))) {
      return new NextResponse("Invalid signature", { status: 403 });
    }

    if (platformTo) {
      const { tryHandleTwilioMctbPlatformSenderInbound } = await import(
        "@/lib/mctb/messaging/twilio-platform-inbound"
      );
      const mediaCount = Number(params.NumMedia || 0);
      const mediaUrls: string[] = [];
      for (let i = 0; i < mediaCount; i += 1) {
        const url = params[`MediaUrl${i}`];
        if (url) mediaUrls.push(url);
      }
      const platformHandled = await tryHandleTwilioMctbPlatformSenderInbound({
        toRaw: to,
        fromE164: from,
        body,
        providerMessageId: params.MessageSid,
        mediaUrls,
      });
      if (platformHandled.plainText) {
        return new NextResponse(platformHandled.plainText, { status: platformHandled.status });
      }
      return new NextResponse(twimlMessage(platformHandled.twimlBody), {
        status: platformHandled.status,
        headers: { "Content-Type": "text/xml" },
      });
    }

    if (!ctx || !from) {
      return new NextResponse(twimlMessage(), {
        headers: { "Content-Type": "text/xml" },
      });
    }

    try {
      const mediaCount = Number(params.NumMedia || 0);
      const mediaUrls: string[] = [];
      for (let i = 0; i < mediaCount; i += 1) {
        const url = params[`MediaUrl${i}`];
        if (url) mediaUrls.push(url);
      }
      const result = await processInboundMessage({
        workspaceId: ctx.workspaceId,
        from,
        to: ctx.phoneE164 || to,
        body,
        providerMessageId: params.MessageSid,
        mediaUrls,
        registration: ctx.registration,
      });

      return new NextResponse(twimlMessage(result.replyText, result.mediaUrls), {
        headers: { "Content-Type": "text/xml" },
      });
    } catch (err) {
      if (body.toUpperCase().match(/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)$/)) {
        console.error("[twilio/inbound] STOP persistence failed", err);
        return new NextResponse("STOP processing failed", { status: 500 });
      }
      throw err;
    }
  } catch (err) {
    console.error("[twilio/inbound]", err);
    return new NextResponse("Inbound processing failed", { status: 500 });
  }
}
