import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/messaging/crypto";
import { getTwilioParentCredentials, isLiveMessagingAdapter } from "@/lib/messaging/twilio-config";
import { validateTwilioSignature } from "@/lib/messaging/twilio-client";
import {
  buildTwilioDialStatusTwiml,
  buildTwilioInboundTwiml,
} from "@/lib/numbers/providers/voice/twilio-personal-voice";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

async function verifySignature(request: Request, params: Record<string, string>) {
  const signature = request.headers.get("x-twilio-signature") || "";
  if (!signature) {
    if (process.env.NODE_ENV === "production") return false;
    if (isLiveMessagingAdapter()) return false;
    return true;
  }
  const tokens: string[] = [];
  const parent = getTwilioParentCredentials().authToken;
  if (parent) tokens.push(parent);
  if (!tokens.length) return process.env.NODE_ENV !== "production";
  return tokens.some((token) => validateTwilioSignature(token, signature, request.url, params));
}

function twimlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const params = await parseTwilioForm(request);
  if (!(await verifySignature(request, params))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const callSid = params.CallSid || "";
  const from = params.From || "";
  const to = params.To || "";
  const dialStatus = params.DialCallStatus;
  const url = new URL(request.url);
  const humanCallId = url.searchParams.get("humanCallId");

  if (dialStatus && humanCallId) {
    const xml = await buildTwilioDialStatusTwiml({
      dialCallStatus: dialStatus,
      humanCallId,
    });
    return twimlResponse(xml);
  }

  const xml = await buildTwilioInboundTwiml({ callSid, from, to });
  return twimlResponse(xml);
}
