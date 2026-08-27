import { NextResponse } from "next/server";
import { handleMctbEventOnlyTelnyxWebhook } from "@/lib/mctb/event-only/telnyx-handler";
import { readTelnyxWebhook } from "@/lib/messaging/telnyx/webhook-auth";

type TelnyxPayload = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: Record<string, unknown>;
  };
};

const FALLBACK_WORKSPACE_ID =
  process.env.MCTB_PLATFORM_OWNER_WORKSPACE_ID?.trim() || "cmt2zyg4l43373s0f146b442h";

/**
 * Telnyx EVENT_ONLY MCTB: existing handler for 571 + FQDN direct SIP (no LiveKit).
 * FQDN path answers via Call Control so forwarded calls stay connected.
 */
export async function POST(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const body = verified.payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  try {
    const result = await handleMctbEventOnlyTelnyxWebhook({
      eventType,
      eventPayload,
      fallbackWorkspaceId: FALLBACK_WORKSPACE_ID,
    });
    return NextResponse.json({
      ok: true,
      source: "mctb-event-only",
      eventType,
      providerEventId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        source: "mctb-event-only",
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
    service: "mctb-event-only",
    flow: "call.initiated/hangup → capture metadata → Existing Consent eligibility → queue SMS (no voice media)",
  });
}
