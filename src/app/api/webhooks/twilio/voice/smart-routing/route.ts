import { NextResponse } from "next/server";
import { processTwilioSmartRoutingCallback } from "@/lib/smart-routing/twilio-webhook-handler";
import { verifyTwilioVoiceWebhookSignature } from "@/lib/numbers/providers/voice/twilio-voice-webhook-auth";

async function parseTwilioForm(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  form.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}

function twimlResponse(xml: string) {
  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(request: Request) {
  const params = await parseTwilioForm(request);
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const event = url.searchParams.get("event") ?? "";

  if (!(await verifyTwilioVoiceWebhookSignature(request, params, params.To))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  if (!sessionId || !event) {
    return twimlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`,
    );
  }

  const xml = await processTwilioSmartRoutingCallback({
    sessionId,
    event,
    digits: params.Digits,
    dialCallStatus: params.DialCallStatus,
    recordingUrl: params.RecordingUrl,
    callSid: params.CallSid,
  });

  return twimlResponse(xml);
}
