import { NextResponse } from "next/server";
import { verifyTwilioVoiceWebhookSignature } from "@/lib/numbers/providers/voice/twilio-voice-webhook-auth";
import { handleMctbTwilioIngressVoice } from "@/lib/mctb/voice-bridge/twilio-ingress";

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

/**
 * Twilio second-hop ingress for MCTB voice bridge (855).
 */
export async function POST(request: Request) {
  const params = await parseTwilioForm(request);
  if (!(await verifyTwilioVoiceWebhookSignature(request, params, params.To))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  try {
    const result = await handleMctbTwilioIngressVoice(params);
    return twimlResponse(result.twiml);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        source: "mctb-twilio-ingress",
        event: "handler_error",
        error: message,
        callSid: params.CallSid || null,
      }),
    );
    return twimlResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>We are unable to complete your call right now.</Say><Hangup/></Response>`,
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mctb-twilio-ingress",
    flow: "Twilio 855 → correlate first hop → diagnostic Say → Hangup",
  });
}
