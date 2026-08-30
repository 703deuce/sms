import { NextResponse } from "next/server";
import { handleMctbVoiceBridgeTelnyxEvent } from "@/lib/mctb/voice-bridge/telnyx-handler";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
  };
};

/**
 * Telnyx first-hop MCTB voice bridge: capture metadata on 571, transfer voice to Twilio 855.
 */
export async function POST(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const body = verified.payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  try {
    const result = await handleMctbVoiceBridgeTelnyxEvent({
      eventType,
      eventPayload,
    });
    return NextResponse.json({
      ok: true,
      source: "mctb-voice-bridge",
      eventType,
      providerEventId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        source: "mctb-voice-bridge",
        event: "handler_error",
        eventType,
        providerEventId,
        error: message,
        callControlId: eventPayload.call_control_id ?? null,
      }),
    );
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mctb-voice-bridge",
    flow: "call.initiated → answer → call.answered → capture first hop → transfer → Twilio 855",
  });
}
