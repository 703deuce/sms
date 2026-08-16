import { NextResponse } from "next/server";
import {
  buildTwilioDialStatusTwiml,
  buildTwilioInboundTwiml,
} from "@/lib/numbers/providers/voice/twilio-personal-voice";
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
