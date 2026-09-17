import { NextRequest, NextResponse } from "next/server";
import { handleOpenAiLiveIncomingWebhook } from "@/lib/voice-v3-basic/openai-live-webhook";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "openai-live-incoming",
    voice: "voice-v3-basic",
  });
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  try {
    const result = await handleOpenAiLiveIncomingWebhook({
      rawBody,
      headers: req.headers,
    });

    if (result.handled && result.accepted === false && result.reason === "missing_session_id") {
      return NextResponse.json({ error: "Missing Live session ID" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.toLowerCase().includes("signature") || message.toLowerCase().includes("webhook")) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }
    console.error("OPENAI_LIVE_WEBHOOK_HANDLER_ERROR", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
