import { NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { getActiveMediaBackend } from "@/lib/voice/media-backend/resolver";
import { getLiveKitBackendConfig } from "@/lib/voice/media-backend/config";
import { ingestLiveKitEgressEnded } from "@/lib/voice-v3/post-call/livekit-egress-ingest";

export async function POST(request: Request) {
  const cfg = getLiveKitBackendConfig(getActiveMediaBackend());
  const receiver = new WebhookReceiver(cfg.apiKey, cfg.apiSecret);
  const rawBody = await request.text();
  const authHeader = request.headers.get("authorization") || "";

  let event: { event?: string; egressInfo?: Record<string, unknown> };
  try {
    event = (await receiver.receive(rawBody, authHeader)) as {
      event?: string;
      egressInfo?: Record<string, unknown>;
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("LIVEKIT_WEBHOOK_AUTH_FAILED", { message });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventName = String(event.event || "").toLowerCase();
  if (eventName === "egress_ended" || eventName === "egress_updated") {
    await ingestLiveKitEgressEnded({
      egressInfo: event.egressInfo || {},
      event: eventName,
    });
  }

  return NextResponse.json({ ok: true });
}
