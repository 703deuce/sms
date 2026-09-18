import { NextResponse } from "next/server";
import { handleVoiceV3BasicTelnyxWebhook } from "@/lib/voice-v3-basic/telnyx-webhook-handler";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    payload?: Record<string, unknown>;
  };
};

/**
 * Isolated Call Control webhook for Voice V3 Basic:
 * inbound PSTN → transfer to OpenAI Live SIP (proj_@sip.api.openai.com).
 * No media bridge, no Voice V2.
 */
export async function POST(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const body = verified.payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  try {
    const result = await handleVoiceV3BasicTelnyxWebhook({ eventType, eventPayload });
    return NextResponse.json({
      ok: true,
      source: "voice-v3-basic",
      eventType,
      providerEventId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("VOICE_V3_BASIC_TELNYX_WEBHOOK_ERROR", { eventType, providerEventId, message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "voice-v3-basic-telnyx",
    flow: "call.initiated → answer → transfer → sip:proj_@sip.api.openai.com",
  });
}
