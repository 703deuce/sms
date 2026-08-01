import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/messaging/crypto";
import { processInboundMessage, resolveInboundContext } from "@/lib/messaging/inbound-process";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
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
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    // Unsigned only allowed outside production AND when not live
    if (process.env.NODE_ENV === "production") return false;
    if (isLiveMessagingAdapter()) return false;
    return true;
  }

  const tokens: string[] = [];
  if (registration?.subaccountAuthTokenEnc) {
    try {
      tokens.push(decryptSecret(registration.subaccountAuthTokenEnc));
    } catch {
      // ignore decrypt errors
    }
  }
  const parent = getTwilioParentCredentials().authToken;
  if (parent) tokens.push(parent);

  if (!tokens.length) return process.env.NODE_ENV !== "production";

  return tokens.some((token) => validateTwilioSignature(token, signature, request.url, params));
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

    const ctx = await resolveInboundContext(to, params.AccountSid);
    if (!(await verifySignature(request, params, ctx?.registration))) {
      return new NextResponse("Invalid signature", { status: 403 });
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
