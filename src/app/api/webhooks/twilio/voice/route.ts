import { NextResponse } from "next/server";
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

/** Legacy Twilio voice ingress — MCTB uses `/api/twilio/voice/mctb-ingress`. */
export async function POST(request: Request) {
  try {
    const params = await parseTwilioForm(request);
    if (!(await verifyTwilioVoiceWebhookSignature(request, params, params.To))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
    return twimlResponse(
      "<Say>This number is configured for Missed Call Text Back. Please use your published business forwarding setup.</Say><Hangup/>",
    );
  } catch (err) {
    console.error("[twilio/voice] webhook handler failed", err);
    return twimlResponse(
      "<Say>We are unable to complete your call right now. Please try again later.</Say><Hangup/>",
    );
  }
}
