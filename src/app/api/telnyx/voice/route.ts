import { NextResponse } from "next/server";
import { handleTelnyxVoiceWebhook } from "@/lib/voice/telnyx/webhook-handlers";

/** Telnyx Call Control + AI voice webhook endpoint */
export async function POST(request: Request) {
  try {
    const result = await handleTelnyxVoiceWebhook(request);
    if (result instanceof NextResponse) return result;
    return NextResponse.json(result);
  } catch (err) {
    console.error("[telnyx/voice]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook failed" },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "telnyx-voice-webhook" });
}
