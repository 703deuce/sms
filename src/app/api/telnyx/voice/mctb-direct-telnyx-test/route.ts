import { NextResponse } from "next/server";
import { MCTB_TELNYX_FQDN_TEST_E164 } from "@/lib/mctb/onboarding/constants";
import { handleMctbDirectTelnyxTestEvent } from "@/lib/mctb/direct-telnyx-test/handler";
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
 * Isolated Telnyx direct-path test — FQDN 3PCC + PRACK, no LiveKit.
 * Only handles inbound to MCTB_TELNYX_FQDN_TEST_E164 (+18663464256).
 */
export async function POST(request: Request) {
  const verified = await readTelnyxWebhook(request);
  if (!verified.ok) return verified.response;

  const body = verified.payload as TelnyxPayload;
  const eventType = body.data?.event_type || "unknown";
  const providerEventId = body.data?.id || `${eventType}:${Date.now()}`;
  const eventPayload = (body.data?.payload || {}) as Record<string, unknown>;

  try {
    const result = await handleMctbDirectTelnyxTestEvent({ eventType, eventPayload });
    return NextResponse.json({
      ok: true,
      source: "mctb-direct-telnyx-test",
      eventType,
      providerEventId,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        source: "mctb-direct-telnyx-test",
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
    service: "mctb-direct-telnyx-test",
    testNumber: MCTB_TELNYX_FQDN_TEST_E164,
    flow:
      "FQDN 3PCC ingress → call.initiated → answer → call.answered → speak → hold ≥15s → call.hangup → normalized event (no LiveKit)",
  });
}
