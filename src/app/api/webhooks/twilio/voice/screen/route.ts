import { NextResponse } from "next/server";
import { buildTwilioScreenTwiml } from "@/lib/numbers/providers/voice/twilio-personal-voice";
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
  if (!(await verifyTwilioVoiceWebhookSignature(request, params, params.To))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const url = new URL(request.url);
  const humanCallId = url.searchParams.get("humanCallId") || "";
  const digits = params.Digits || "";

  const xml = await buildTwilioScreenTwiml({ humanCallId, digits });
  return twimlResponse(xml);
}
